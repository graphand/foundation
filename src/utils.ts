import {
  Model,
  controllersMap,
  Validator,
  ValidationValidatorError,
  Field,
  ValidationFieldError,
  CoreError,
} from "@graphand/core";
import ClientModelAdapter from "./lib/ClientModelAdapter";
import Client from "./lib/Client";
// @ts-ignore
import https from "https";
import FetchError from "./lib/FetchError";
import FetchValidationError from "./lib/FetchValidationError";
import { MiddlewareInput } from "./types";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

export const getClientFromModel = (model: typeof Model) => {
  const adapter = model.__adapter as ClientModelAdapter;

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

  // @ts-ignore
  init.agent ??= agent;
  init.headers ??= {};
  init.headers["Accept"] = "application/json";
  init.headers["Content-Type"] = "application/json";

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
