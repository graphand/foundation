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
  AuthMethods,
  ControllerDefinition,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import Client from "./Client";
import FetchError from "./FetchError";
import FetchValidationError from "./FetchValidationError";
import { ClientHookPayload, ClientOptions, ExecuteOpts } from "../types";
import { Socket } from "socket.io-client";
import ClientError from "./ClientError";
import ErrorCodes from "../enums/error-codes";

const debug = require("debug")("graphand:client");

export const getClientFromModel = (model: typeof Model) => {
  const adapter = model.getAdapter() as ClientAdapter;

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

export const getControllerUrl = (
  client: Client,
  controller: (typeof controllersMap)[keyof typeof controllersMap],
  opts: {
    path?: { [key: string]: string };
    query?: any;
    body?: any;
    sendAsFormData?: boolean;
  } = {}
) => {
  const scopeArgs: any = {};

  const path = controller.path.replace(/\:(\w+)(\?)?/g, (match, p1) => {
    scopeArgs[p1] = opts.path[p1];
    return opts.path[p1] ? encodeURIComponent(opts.path[p1]) : "";
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
          message: `Client must be configured with a project to use controller on path ${controller.path}`,
        });
      }

      url = scheme + client.options.project + "." + endpoint + path;
    } else {
      url = scheme + endpoint + path;
    }
  }

  // remove trailing slash
  url = url.replace(/\/$/, "");

  if (opts.query) {
    const queryObjEntries = Object.entries(opts.query).filter(
      ([, v]) => v !== undefined
    ) as Array<[string, string]>;

    if (queryObjEntries.length) {
      url += "?" + new URLSearchParams(Object.fromEntries(queryObjEntries));
    }
  }

  return url;
};

export const executeController = async (
  client: Client,
  controller: ControllerDefinition,
  opts: ExecuteOpts = {}
) => {
  const retryToken = Symbol();
  const payloadBefore: ClientHookPayload<"before"> = {
    controller,
    retryToken,
    opts,
  };

  await client.executeHooks("before", controller, payloadBefore);

  if (payloadBefore.err?.length) {
    if (payloadBefore.err.includes(retryToken)) {
      return await executeController(client, controller, opts);
    }

    throw payloadBefore.err[0];
  }

  let sendingFormKey;
  const init: RequestInit = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  const methods = new Set(controller.methods);

  if (opts?.body) {
    methods.delete("GET");
    if (opts.sendAsFormData) {
      const parsePayloadToFormData = (payload: any): FormData => {
        const formData = new FormData();

        const traverseObject = (obj: any) => {
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];

              if (value instanceof Blob) {
                if (!value.type) {
                  throw new ClientError({
                    code: ErrorCodes.INVALID_FILE_TYPE,
                    message: `File ${key} has invalid type ${value.type}`,
                  });
                }
                const fileKey = Math.random().toString(36).substr(2, 9);
                formData.append(fileKey, value);
                obj[key] = `file:${fileKey}`;
              } else if (typeof value === "object" && value !== null) {
                traverseObject(value);
              }
            }
          }
        };

        traverseObject(payload);

        formData.append("data", JSON.stringify(payload));

        return formData;
      };

      sendingFormKey = String(new Date().getTime());

      console.log("sendingFormKey", sendingFormKey);

      const sendingKeys = client.__sendingFormKeysSubject.getValue();
      sendingKeys.add(sendingFormKey);
      client.__sendingFormKeysSubject.next(sendingKeys);

      init.body = parsePayloadToFormData(opts.body);
      init.headers["Form-Key"] = sendingFormKey;
      delete init.headers["Content-Type"];
    } else {
      init.body = JSON.stringify(opts.body);
    }
  }

  const [method] = methods;
  init.method = method;

  if (init.method !== "GET" && client.__socketsMap?.size) {
    init.headers["Sockets"] = Array.from(client.__socketsMap.values())
      .map((s) => s.id)
      .filter(Boolean);
  }

  if (controller.secured && client.options.accessToken) {
    init.headers["Authorization"] = `Bearer ${client.options.accessToken}`;
  }

  const url = getControllerUrl(client, controller, opts);

  const _fetch = (retrying = false) => {
    debug(`fetching ${url} [${init.method}] ...`, JSON.stringify(init));
    return fetch(url, init).then(async (r) => {
      let res = await r.json();

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

        payloadBefore.err ??= [];
        payloadBefore.err.push(parseError(res.error));
      }

      if (res.exceptions?.length) {
        res.exceptions.forEach((e: any) => {
          console.warn(e.message);
        });
      }

      const payloadAfter: ClientHookPayload<"after"> = {
        ...payloadBefore,
        data: res.data,
        fetchResponse: r,
      };

      await client.executeHooks("after", controller, payloadAfter);

      if (payloadAfter.err?.length) {
        if (payloadAfter.err.includes(retryToken)) {
          return await executeController(client, controller, opts);
        }

        throw payloadAfter.err[0];
      }

      return payloadAfter.data;
    });
  };

  return _fetch()
    .catch((e) => {
      debug(`error on fetching ${url} :`, e.message);
      throw e;
    })
    .finally(() => {
      const sendingKeys = client.__sendingFormKeysSubject.getValue();
      sendingKeys.delete(sendingFormKey);
      client.__sendingFormKeysSubject.next(sendingKeys);
    });
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
      model.getAdapter(),
      _field.__path + ".[]"
    );

    let arrValue = Array.isArray(d[fp.key]) ? d[fp.key] : [d[fp.key]];

    if (itemsField.type === FieldTypes.RELATION) {
      const _itemsField = itemsField as Field<FieldTypes.RELATION>;
      const refModel = Model.getFromSlug.call(model, _itemsField.options.ref);
      const adapter = refModel.getAdapter() as ClientAdapter;

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

      if (updated.length) {
        adapter.updaterSubject.next({
          ids: updated,
          operation: "fetch",
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
    const adapter = refModel.getAdapter() as ClientAdapter;

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

    if (updated) {
      adapter.updaterSubject.next({
        ids: [mapped._id],
        operation: "fetch",
      });
    }

    d[fp.key] = mapped._id;

    return;
  }

  if (fp.field.type === FieldTypes.NESTED) {
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

export const useFormsOnSocket = (socket: Socket, keys: Array<string>) => {
  if (!socket.connected) {
    return;
    // throw new ClientError({
    //   message: "Socket must be connected to use realtime",
    //   code: ErrorCodes.SOCKET_NOT_CONNECTED,
    // });
  }

  const keysStr = keys.join(",");
  debug(`emit on socket ${socket.id} to use forms with keys ${keysStr}`);
  socket.emit("use-forms", keysStr);
};

export const handleAuthResponse = async (
  res: {
    url?: string;
    accessToken?: string;
    refreshToken?: string;
  },
  method: AuthMethods,
  client: Client
): Promise<{
  accessToken: string;
  refreshToken: string;
}> => {
  let accessToken = res.accessToken;
  let refreshToken = res.refreshToken;

  if (accessToken && refreshToken) {
    return {
      accessToken,
      refreshToken,
    };
  }

  if (res.url) {
    const controller = client.options.authControllersMap.get(method);
    if (!controller) {
      throw new ClientError({
        message: `auth controller for method ${method} not implemented`,
      });
    }

    const authResult = await controller(res.url, client);

    accessToken = authResult.accessToken;
    refreshToken = authResult.refreshToken;
  }

  if (!accessToken || !refreshToken) {
    throw new ClientError({
      message: "No access token or refresh token",
    });
  }

  console.log({
    accessToken,
    refreshToken,
  });

  return {
    accessToken,
    refreshToken,
  };
};

export const handleAuthRedirect = (options: ClientOptions) => {
  if (typeof globalThis.window === "undefined") {
    throw new ClientError({
      message: "handleAuthRedirect must be called on a browser environment",
    });
  }

  const _window: any = globalThis.window;

  const url = new URL(_window.location.href);
  const authResult = url.searchParams.get("authResult");
  if (authResult) {
    const { accessToken, refreshToken } = JSON.parse(authResult);
    console.log({
      accessToken,
    });
    if (accessToken) {
      options.accessToken = accessToken;
    }
    if (refreshToken) {
      options.refreshToken = refreshToken;
    }

    const parsedUrl = new URL(_window.location.href);
    parsedUrl.searchParams.delete("authResult");
    globalThis.history?.replaceState({}, "", parsedUrl.toString());
  }
};
