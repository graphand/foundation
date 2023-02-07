import { Model, controllersMap } from "@graphand/core";
import ClientModelAdapter from "./lib/ClientModelAdapter";
import Client from "./lib/Client";
// @ts-ignore
import https from "https";

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

export const executeController = async (
  client: Client,
  controller: typeof controllersMap[keyof typeof controllersMap],
  opts: {
    path?: { [key: string]: string };
    query?: any;
    body?: any;
  }
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
    const domain = "api.graphand.io.local:1337";

    let scope = controller.scope;
    if (typeof scope === "function") {
      scope = scope(scopeArgs);
    }

    if (scope === "project") {
      url = scheme + client.options.project + "." + domain + path;
    } else {
      url = scheme + domain + path;
    }
  }

  if (opts.query) {
    url += "?" + new URLSearchParams(opts.query);
  }

  // @ts-ignore
  init.agent ??= agent;
  init.headers ??= {};
  init.headers["Accept"] = "application/json";
  init.headers["Content-Type"] = "application/json";

  if (controller.secured) {
    if (!client.options.accessToken) {
      throw new Error("CLIENT_NO_ACCESS_TOKEN");
    }

    init.headers["Authorization"] = `Bearer ${client.options.accessToken}`;
  }

  return fetch(url, init).then((r) => r.json());
};
