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
  PopulateOption,
  DocumentDefinition,
  getFieldsPathsFromPath,
  getFieldFromDefinition,
  FieldsPathItem,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import Client from "./Client";
import FetchError from "./FetchError";
import FetchValidationError from "./FetchValidationError";
import { MiddlewareInput } from "../types";
import { Socket } from "socket.io-client";
import ClientError from "./ClientError";
import ErrorCodes from "../enums/error-codes";

const debug = require("debug")("graphand:client");

export const getClientFromModel = (model: typeof Model) => {
  const adapter = model.__adapter as ClientAdapter;

  if (!adapter.client) {
    throw new ClientError({
      code: ErrorCodes.MODEL_NO_CLIENT,
      message:
        "Model must be initialized with a client. Please use client.getModel() method first",
    });
  }

  return adapter.client;
};

export const parseError = (error: any): CoreError => {
  if (error.type === "ValidationError") {
    const validators = error.reason.validators.map((v: any) => {
      const validator = new Validator(v.validator, v.validator.path);
      return new ValidationValidatorError({ validator });
    });

    const fields = error.reason.fields.map((v: any) => {
      let validationError: CoreError;
      let field: Field;

      if (v.validationError) {
        validationError = parseError(v.validationError);
      }
      if (v.field) {
        const { type, options, path } = v.field;
        field = new Field({ type, options }, path);
      }

      return new ValidationFieldError({ ...v, validationError, field });
    });

    return new FetchValidationError({ validators, fields });
  }

  return new FetchError(error);
};

export const executeController = async (
  client: Client,
  controller: (typeof controllersMap)[keyof typeof controllersMap],
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
    return opts.path[p1] || "";
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
        throw new ClientError({
          code: ErrorCodes.CLIENT_NO_PROJECT,
          message: "Client must be configured with a project to use controller",
        });
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
    init.headers["Sockets"] = Array.from(client.__socketsMap.values())
      .map((s) => s.id)
      .filter(Boolean);
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
    debug(`fetching ${url} [${init.method}] ...`, JSON.stringify(init));
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
        debug(`error on fetching ${url} :`, e.message);
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

const _decodePopulate = async (
  p: PopulateOption,
  d: DocumentDefinition,
  fieldsPaths: Array<FieldsPathItem>,
  model: typeof Model
) => {
  if (!d || !fieldsPaths.length) {
    return;
  }

  const [fp, ...restPath] = fieldsPaths;

  if (!fp?.field) {
    return;
  }

  if (fp.field.type === FieldTypes.ARRAY && d[fp.key]) {
    const _field = fp.field as Field<FieldTypes.ARRAY>;
    const itemsField = getFieldFromDefinition(
      _field.options.items,
      model.__adapter,
      _field.__path + ".[]"
    );

    let arrValue = Array.isArray(d[fp.key]) ? d[fp.key] : [d[fp.key]];

    if (itemsField.type === FieldTypes.RELATION) {
      const _itemsField = itemsField as Field<FieldTypes.RELATION>;
      const refModel = Model.getFromSlug.call(model, _itemsField.options.ref);
      const adapter = refModel.__adapter as ClientAdapter;

      if (p.populate) {
        await parsePopulated(
          refModel,
          arrValue,
          getPopulatedFromQuery({ populate: p.populate })
        );
      }

      const mappedList = arrValue.map((r) => adapter.mapOrNew(r));
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

      d[fp.key] = mappedRes.map((r) => r._id);

      return;
    }

    const _fieldsPaths = [
      { key: "[]", field: itemsField },
      ...restPath.splice(1),
    ];

    const encodedValues = arrValue.map((v) => ({ "[]": v }));

    await Promise.all(
      encodedValues.map((_d) => _decodePopulate(p, _d, _fieldsPaths, model))
    );

    d[fp.key] = encodedValues.map((v) => v["[]"]);

    return;
  }

  if (fp.field.type === FieldTypes.RELATION) {
    const _field = fp.field as Field<FieldTypes.RELATION>;
    const refModel = Model.getFromSlug.call(model, _field.options.ref);
    const adapter = refModel.__adapter as ClientAdapter;

    const value = d[fp.key];
    if (!value || typeof value !== "object" || !value?._id) {
      return;
    }

    if (p.populate) {
      await parsePopulated(
        refModel,
        [value],
        getPopulatedFromQuery({ populate: p.populate })
      );
    }

    const { mapped, updated } = adapter.mapOrNew(value);

    adapter.updaterSubject.next({
      ids: [mapped._id],
      operation: "fetch",
    });

    if (updated) {
      adapter.updaterSubject.next({
        ids: [mapped._id],
        operation: "localUpdate",
      });
    }

    d[fp.key] = mapped._id;

    return;
  }

  if (fp.field.type === FieldTypes.JSON) {
    await _decodePopulate(p, d[fp.key], restPath, model);
    return;
  }
};

export const parsePopulated = async <T extends typeof Model>(
  model: T,
  documents: Array<DocumentDefinition>,
  populated: Array<PopulateOption>
) => {
  if (!populated?.length) {
    return;
  }

  await model.initialize();

  await Promise.all(
    populated.map(async (p) => {
      const fieldsPaths = getFieldsPathsFromPath(model, p.path);

      await Promise.all(
        documents.map((d) => _decodePopulate(p, d, fieldsPaths, model))
      );
    })
  );
};

export const useRealtimeOnSocket = (socket: Socket, slugs: Array<string>) => {
  if (!socket.connected) {
    return;
    // throw new ClientError({
    //   message: "Socket must be connected to use realtime",
    //   code: ErrorCodes.SOCKET_NOT_CONNECTED,
    // });
  }

  const slugsStr = slugs.join(",");
  debug(`emit on socket ${socket.id} to use realtime for models ${slugsStr}`);
  socket.emit("use-realtime", slugsStr);
};
