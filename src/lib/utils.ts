import {
  Model,
  controllersMap,
  Validator,
  ValidationValidatorError,
  Field,
  ValidationFieldError,
  CoreError,
  JSONQuery,
  FieldTypes,
  getFieldFromPath,
  getValueFromPath,
  PopulateOption,
  setValueOnPath,
  DocumentDefinition,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import Client from "./Client";
import FetchError from "./FetchError";
import FetchValidationError from "./FetchValidationError";
import { MiddlewareInput } from "../types";
import { Socket } from "socket.io-client";

const debug = require("debug")("graphand:client");

export const getClientFromModel = (model: typeof Model) => {
  const adapter = model.__adapter as ClientAdapter;

  if (!adapter.client) {
    throw new Error("MODEL_NO_CLIENT");
  }

  return adapter.client;
};

export const parseError = (error: any): CoreError => {
  if (error.type === "ValidationError") {
    const validators = error.reason.validators.map((v: any) => {
      const validator = new Validator(v.validator);
      return new ValidationValidatorError({ validator });
    });

    const fields = error.reason.fields.map((v: any) => {
      const validationError =
        v.validationError && parseError(v.validationError);
      const field = v.field && new Field(v.field);
      return new ValidationFieldError({ ...v, validationError, field });
    });

    return new FetchValidationError({ validators, fields });
  }

  return new FetchError(error);
};

export const executeController = async (
  client: Client,
  controller: typeof controllersMap[keyof typeof controllersMap],
  opts: {
    path?: { [key: string]: string };
    query?: any;
    body?: any;
  } = {}
) => {
  const init: RequestInit = {};

  const methods = new Set(controller.methods);

  if (opts?.body) {
    methods.delete("GET");
    init.body = JSON.stringify(opts.body);
  }

  const [method] = methods;
  init.method = method;

  const scopeArgs: any = {};

  const path = controller.path.replace(/\:(\w+)(\?)?/g, (match, p1) => {
    scopeArgs[p1] = opts.path[p1];
    return opts.path[p1];
  });

  let url;
  if (typeof path !== "string" || path.includes(`://`)) {
    url = path;
  } else {
    const scheme = "https://";
    const endpoint = client.options.endpoint;

    let scope = controller.scope;
    if (typeof scope === "function") {
      scope = scope(scopeArgs);
    }

    if (scope === "project") {
      if (!client.options.project) {
        throw new Error("CLIENT_NO_PROJECT");
      }

      url = scheme + client.options.project + "." + endpoint + path;
    } else {
      url = scheme + endpoint + path;
    }
  }

  if (opts.query) {
    const queryObjEntries = Object.entries(opts.query).filter(
      ([, v]) => v !== undefined
    ) as Array<[string, string]>;

    if (queryObjEntries.length) {
      url += "?" + new URLSearchParams(Object.fromEntries(queryObjEntries));
    }
  }

  init.headers ??= {};
  init.headers["Accept"] = "application/json";
  init.headers["Content-Type"] = "application/json";

  if (init.method !== "GET" && client.__socketsMap?.size) {
    init.headers["Sockets"] = Array.from(client.__socketsMap.values()).map(
      (s) => s.id
    );
  }

  if (controller.secured && client.options.accessToken) {
    init.headers["Authorization"] = `Bearer ${client.options.accessToken}`;
  }

  const _executeMiddlewares = async (input: MiddlewareInput) => {
    const middlewares = client.__middlewares
      ? Array.from(client.__middlewares)
      : [];

    let err;
    await middlewares.reduce(async (p, middleware) => {
      await p;
      try {
        await middleware.call(this, input);
      } catch (e) {
        err = Array.prototype.concat.apply(err ?? [], [e]);
      }
    }, Promise.resolve());

    if (err) {
      throw err;
    }
  };

  const _fetch = (retrying = false) => {
    debug(`fetching ${url} [${init.method}] ...`);
    return fetch(url, init).then(async (r) => {
      try {
        let res = await r.json();
        let error;

        if (res.error) {
          if (
            r.status === 401 &&
            res.error.code === "TOKEN_EXPIRED" &&
            !retrying
          ) {
            try {
              await client.refreshToken();
              init.headers[
                "Authorization"
              ] = `Bearer ${client.options.accessToken}`;
              return _fetch(true);
            } catch (e) {}
          }

          error = parseError(res.error);
        }

        const retryToken = Symbol();
        const payload = { data: res.data, error, fetchResponse: r, retryToken };
        try {
          await _executeMiddlewares(payload);
        } catch (e) {
          if (Array.isArray(e) && e.includes(retryToken)) {
            return await executeController(client, controller, opts);
          }
        }

        if (payload?.error) {
          throw payload.error;
        }

        return payload.data;
      } catch (e) {
        throw e;
      }
    });
  };

  return _fetch();
};

export const canUseIds = (query: JSONQuery): boolean | Array<string> => {
  if (
    !query.ids?.length ||
    query.filter ||
    query.pageSize ||
    query.limit ||
    query.skip ||
    query.sort ||
    query.populate
  ) {
    return false;
  }

  return [...query.ids];
};

export const getPopulatedFromQuery = (
  query: string | JSONQuery
): Array<PopulateOption> => {
  if (typeof query !== "object" || !query.populate) {
    return;
  }

  const populatedArr = Array.isArray(query.populate)
    ? query.populate
    : [query.populate];

  return populatedArr
    .map((p) => {
      if (typeof p === "string") {
        return {
          path: p,
        };
      }

      if (typeof p === "object" && p.path) {
        return {
          path: p.path,
          filter: p.filter,
          populate: p.populate,
        };
      }

      return null;
    })
    .filter(Boolean);
};

export const parsePopulated = <T extends typeof Model>(
  model: T,
  documents: Array<DocumentDefinition>,
  populated: Array<PopulateOption>
) => {
  if (!populated?.length) {
    return;
  }

  populated.forEach((p) => {
    const _field = getFieldFromPath(model, p.path);

    if (_field?.type !== FieldTypes.RELATION) {
      return;
    }

    const field = _field as Field<FieldTypes.RELATION>;

    const refModel = Model.getFromSlug.call(model, field.options.ref);

    const adapter = refModel.__adapter as ClientAdapter;

    if (!adapter) {
      return;
    }

    documents.forEach((d) => {
      const populatedValue = getValueFromPath(d, p.path);
      let rows;
      let encodedValue;

      if (!populatedValue || typeof populatedValue !== "object") {
        return;
      }

      if (Array.isArray(populatedValue)) {
        rows = populatedValue;
        encodedValue = populatedValue.map((v) => v._id);
      } else {
        rows = [populatedValue];
        encodedValue = populatedValue?._id || null;
      }

      if (p.populate) {
        parsePopulated(
          refModel,
          rows,
          getPopulatedFromQuery({ populate: p.populate })
        );
      }

      setValueOnPath(d, p.path, encodedValue);

      const mappedList = rows.map((r) => adapter.mapOrNew(r));
      const mappedRes = mappedList.map((r) => r.mapped);
      const updated = mappedList
        .filter((r) => r.updated)
        .map((r) => r.mapped._id);

      adapter.updaterSubject.next({
        ids: mappedRes.map((r) => r._id),
        operation: "fetch",
      });

      if (updated?.length) {
        adapter.updaterSubject.next({
          ids: updated,
          operation: "localUpdate",
        });
      }
    });
  });
};

export const useRealtimeOnSocket = (socket: Socket, slugs: Array<string>) => {
  const slugsStr = slugs.join(",");

  debug(`emit on socket ${socket.id} to use realtime for models ${slugsStr}`);
  socket.emit("use-realtime", slugsStr);
};
