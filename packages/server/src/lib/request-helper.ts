import { Adapter, Model } from "@graphand/core";
import { ServerAdapter } from "./adapter.js";
import { env } from "./env.js";
import { Server } from "./server.js";
import { ServerError } from "./server-error.js";

export class RequestHelper {
  #req: Request;
  #adapterClass: typeof ServerAdapter | undefined;
  #server: Server;
  #exceptions: ServerError[] = [];

  constructor(req: Request, server: Server<any>) {
    this.#req = req;
    this.#server = server;
  }

  get req() {
    return this.#req;
  }

  get server() {
    return this.#server;
  }

  get url() {
    return new URL(this.#req.url);
  }

  getAdapterClass(baseClass?: typeof Adapter): typeof ServerAdapter {
    if (!this.#adapterClass) {
      this.setAdapterClass((baseClass as typeof ServerAdapter) ?? ServerAdapter);
    }

    return this.#adapterClass as typeof ServerAdapter;
  }

  setAdapterClass(adapterClass: typeof ServerAdapter) {
    this.#adapterClass = class extends adapterClass {} as typeof ServerAdapter;
    this.#adapterClass.request = this;

    return this;
  }

  model<I extends typeof Model>(input: I | string): I extends string ? typeof Model : I {
    const model = Model.getClass(input as any, this.getAdapterClass());
    model.configuration.loadDatamodel ??= true;
    return model;
  }

  getHeaders(): Record<string, string> {
    return Object.fromEntries(this.#req.headers.entries());
  }

  getHeader(_key: string, _type: "string", _fallback?: string): string;
  getHeader(_key: string, _type: "number", _fallback?: number): number;
  getHeader(_key: string, _type: "boolean", _fallback?: boolean): boolean;
  getHeader(_key: string, _type?: never, _fallback?: string): string;
  getHeader<T extends "string" | "number" | "boolean">(
    key: string,
    type?: T,
    fallback?: string | number | boolean,
  ): string | number | boolean | null {
    const val = this.req.headers.get(key) ?? fallback;

    if (val === null) {
      return null;
    }

    type ??= "string" as T;

    if (type === "boolean") {
      return Boolean(!["false", "0"].includes(String(val)));
    }

    if (type === "number") {
      return Number(val) || 0;
    }

    return String(val);
  }

  parseSubdomain() {
    const hostname = this.getHeader("host");
    if (!hostname) {
      return null;
    }

    const { wildcardDomain } = this.server.options;
    if (!wildcardDomain) {
      return null;
    }

    let environment: string | undefined;
    let projectId: string | undefined;

    // Split hostname into segments
    // api.graphand.com | 677c2a993214063c337d7b77.api.graphand.com | develop.677c2a993214063c337d7b77.api.graphand.com
    const segments = hostname.replace(wildcardDomain, "").split(".");

    if (segments.length === 2) {
      projectId = segments[1];
      environment = segments[0];
    } else if (segments.length === 1) {
      projectId = segments[0];
    } else {
      return null;
    }

    return {
      projectId,
      environment,
    };
  }

  getEnvironment() {
    const subdomain = this.parseSubdomain();
    if (subdomain?.environment) {
      return subdomain.environment;
    }

    const headerEnv = this.getHeader("content-environment");

    if (headerEnv) {
      return headerEnv;
    }

    return env.DEFAULT_ENV;
  }

  hasEnded() {
    // TODO: Implement
    return false;
  }

  addResponseException(exception: ServerError) {
    exception.appName ??= this.#server.appName;
    this.#exceptions.push(exception);
  }

  getResponseExceptions() {
    return this.#exceptions;
  }

  async getIdentityString() {
    return `type:id`;
  }
}
