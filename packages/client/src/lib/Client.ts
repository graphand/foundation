import {
  ClientModules,
  Hook,
  HookCallbackArgs,
  HookPhase,
  ModuleWithConfig,
  SubjectObserver,
  Transaction,
} from "./../types";
import { ClientOptions, ModuleConstructor } from "../types";
import Module, { symbolModuleDestroy, symbolModuleInit } from "./Module";
import { Adapter, ControllerDefinition, CoreError, ErrorCodes, Model } from "@graphand/core";
import ClientError from "./ClientError";
import ClientAdapter from "./ClientAdapter";
import BehaviorSubject from "./BehaviorSubject";

const DEFAULT_OPTIONS: Partial<ClientOptions> = {
  endpoint: "api.graphand.dev",
  ssl: true,
  maxRetries: 3,
};

const decodeClientModule = <T extends ModuleConstructor>(
  module: ModuleWithConfig<T>,
): {
  moduleClass: T;
  conf: ModuleWithConfig<T>[1];
} => {
  let moduleClass: T | undefined;
  let conf: ModuleWithConfig<T>[1];

  if (Array.isArray(module)) {
    moduleClass = module[0];
    conf = module[1];
  }

  if (!moduleClass) {
    throw new Error("Module class not found");
  }

  return { moduleClass, conf: conf || {} };
};

class Client<T extends ModuleConstructor[] = ModuleConstructor[]> {
  #options: BehaviorSubject<ClientOptions>;
  #modules: Map<string, Module>;
  #modulesInitPromises: Map<string, Promise<void> | void> | undefined;
  #hooks: Set<Hook>;
  #adapterClass: typeof ClientAdapter | undefined;

  constructor(modules: ClientModules<T>, options?: ClientOptions) {
    this.#options = new BehaviorSubject(options || { ...DEFAULT_OPTIONS, project: null });

    // Checking there are no duplicate module names
    const moduleNames = modules.map(m => decodeClientModule(m).moduleClass.moduleName);

    if (moduleNames.some(name => !name)) {
      throw new Error("Module names cannot be empty");
    }

    if (new Set(moduleNames).size !== moduleNames.length) {
      throw new Error("Duplicate module names are not allowed");
    }

    this.#hooks = new Set();
    this.#modules = new Map();

    // Registering modules
    modules.forEach(m => this.use(...m));

    // Resolving dependencies
    for (const module of this.#modules.values()) {
      this.resolveDependencies(module);
    }

    // Initializing modules
    this.init().catch(() => null);
  }

  subscribeOptions(observer: SubjectObserver<ClientOptions>) {
    return this.#options.subscribe(observer);
  }

  get options(): ClientOptions {
    const options = this.#options.getValue();
    return { ...DEFAULT_OPTIONS, ...options };
  }

  get<N extends T[number]["moduleName"]>(_name: N): InstanceType<Extract<T[number], { moduleName: N }>>;
  get<M extends Module>(_name: string): M;
  get<M extends ModuleConstructor>(_module: M): InstanceType<M>;
  get(module: string | typeof Module): Module | null {
    const name = String(typeof module === "string" ? module : module.moduleName);
    return this.#modules.get(name) || null;
  }

  use<U extends ModuleConstructor>(...m: ModuleWithConfig<U>): Client<[...T, U]> {
    const { moduleClass, conf } = decodeClientModule(m);

    if (!moduleClass.moduleName) {
      throw new Error("Module name is required");
    }

    if (this.#modules.has(moduleClass.moduleName)) {
      throw new Error(`Module ${moduleClass.moduleName} is already registered`);
    }

    const module = new moduleClass(conf, this);
    this.#modules.set(moduleClass.moduleName, module);

    // Waiting for the client to have finished registering all modules and dependencies bezfore initializing them
    // When using client.use() after the client has registered all modules, this.#modulesInitPromises will be defined and
    // we add the module initialization promise to it
    if (this.#modulesInitPromises) {
      if (this.#modulesInitPromises.has(moduleClass.moduleName)) {
        throw new Error(`Module ${moduleClass.moduleName} is already registered`);
      }

      this.#modulesInitPromises.set(moduleClass.moduleName, module[symbolModuleInit]());
    }

    return this as unknown as Client<[...T, U]>;
  }

  resolveDependencies(module: Module) {
    if (!module.dependencies) {
      return;
    }

    for (const dependency of module.dependencies) {
      if (dependency.moduleName && !this.#modules.has(dependency.moduleName)) {
        this.use(dependency);
      }
    }
  }

  init() {
    if (!this.#modulesInitPromises) {
      this.#modulesInitPromises = new Map();

      for (const module of this.#modules.values()) {
        if (!module.moduleName) {
          throw new Error("Module name is required");
        }

        if (this.#modulesInitPromises.has(module.moduleName)) {
          throw new Error(`Module ${module.moduleName} is already registered`);
        }

        this.#modulesInitPromises.set(module.moduleName, module[symbolModuleInit]());
      }
    }

    return Promise.all(this.#modulesInitPromises.values());
  }

  getBaseUrl(scheme?: string) {
    const { endpoint, project, ssl } = this.options;
    scheme ??= ssl ? "https" : "http";
    if (!project) {
      return `${scheme}://${endpoint}`;
    }

    return `${scheme}://${project}.${endpoint}`;
  }

  getUrl(definition: ControllerDefinition, opts: { path?: Record<string, string>; query?: Record<string, string> }) {
    let path: string = definition.path;

    if (opts.path) {
      path = definition.path.replace(/\:(\w+)(\?)?/g, (match, p1) => {
        return opts.path?.[p1] ? encodeURIComponent(String(opts.path[p1])) : "";
      });
    }

    const base = this.getBaseUrl();

    const url = new URL(path, base);

    if (opts.query) {
      Object.entries(opts.query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  async executeHooks<P extends HookPhase>(
    phase: P,
    payload: HookCallbackArgs<P>,
    transaction: Transaction,
  ): Promise<void> {
    const arr = Array.from(this.#hooks);
    const hooks = arr.filter(h => h.phase === phase).sort((a, b) => (a.order || 0) - (b.order || 0));
    const executed = new Set();

    try {
      await hooks.reduce(async (p, hook) => {
        await p;

        if (payload.err?.length) {
          return;
        }

        executed.add(hook);
        await hook.fn.call(this, payload);
      }, Promise.resolve());
    } catch (e) {
      if (transaction.abortToken === e) {
        throw new CoreError({
          code: ErrorCodes.EXECUTION_ABORTED,
          message: `Execution has been aborted`,
        });
      }

      payload.err ??= [];
      payload.err.push(e as Error);
    }

    if (payload.err?.length) {
      const handleErrorsHooks = hooks.filter(h => h.handleErrors && !executed.has(h));

      await handleErrorsHooks.reduce(async (p, h) => {
        await p;

        try {
          executed.add(h);
          await h.fn.call(this, payload);
        } catch (e) {
          payload.err ??= [];
          payload.err.push(e as Error);
        }
      }, Promise.resolve());
    }
  }

  getAdapterClass(baseClass?: typeof Adapter) {
    if (!this.#adapterClass) {
      this.setAdapterClass((baseClass as typeof ClientAdapter) ?? ClientAdapter);
    }

    return this.#adapterClass;
  }

  setAdapterClass(adapterClass: typeof ClientAdapter) {
    this.#adapterClass = class extends adapterClass {};
    this.#adapterClass.client = this;

    return this;
  }

  declareGlobally() {
    // @ts-expect-error - __GLOBAL_ADAPTER__ is used by @graphand/core
    globalThis.__GLOBAL_ADAPTER__ = this.getAdapterClass();
  }

  getModel: (typeof Model)["getClass"] = (input, adapterClass) => {
    return Model.getClass(input, this.getAdapterClass(adapterClass));
  };

  async execute(
    definition: ControllerDefinition,
    opts: {
      path?: Record<string, string>;
      query?: Record<string, string>;
      init?: RequestInit;
      maxRetries?: number;
    } = {},
    transaction?: Transaction,
  ): Promise<Response> {
    await this.init();

    transaction ??= {
      retryToken: Symbol("retry"),
      abortToken: Symbol("abort"),
      retries: -1,
    };

    transaction.retries += 1;

    const maxRetries = opts.maxRetries ?? this.options.maxRetries;
    if (maxRetries && transaction.retries > maxRetries) {
      throw new CoreError({
        // code: ErrorCodes.TOO_MANY_RETRIES,
        message: `Too many retries`,
      });
    }

    const { path, query } = opts;

    const url = this.getUrl(definition, { path, query });

    const init: RequestInit = opts.init ?? {};

    const order = ["put", "post", "patch", "delete", "get", "options"] as Array<(typeof definition)["methods"][number]>;
    const method = order.filter(m => definition.methods.includes(m)).at(0) || "get";

    init.method ??= method.toUpperCase();

    if (this.options.headers) {
      init.headers ??= {};
      Object.assign(init.headers, this.options.headers);
    }

    if (definition.secured) {
      if (!this.options.accessToken) {
        throw new Error("Access token is required");
      }

      init.headers ??= {};
      Object.assign(init.headers, { Authorization: `Bearer ${this.options.accessToken}` });
    }

    const request = new Request(url, init);

    const payloadBefore: HookCallbackArgs<"beforeRequest"> = {
      req: request,
      transaction,
      err: undefined,
    };

    let res: Response | undefined = undefined;

    await this.executeHooks("beforeRequest", payloadBefore, transaction);

    if (payloadBefore.err?.length) {
      if (transaction.retryToken && payloadBefore.err?.includes(transaction.retryToken)) {
        return await this.execute(definition, opts, transaction);
      }

      throw payloadBefore.err.at(-1);
    }

    try {
      res = await fetch(request);

      if (!res.ok) {
        const type = res.headers.get("content-type");
        if (type?.includes("application/json")) {
          const json = await res.json().then(r => r.error);

          if (json?.type === "ValidationError") {
            // TODO: parse the json error
          }

          throw new ClientError(json);
        }

        if (type?.includes("text/plain")) {
          const data = await res.text();
          throw new ClientError({ message: data });
        }

        throw new ClientError({ message: "Unknown error" });
      }
    } catch (e) {
      payloadBefore.err ??= [];
      payloadBefore.err.push(e as Error);
    }

    const payloadAfter: HookCallbackArgs<"afterRequest"> = {
      ...payloadBefore,
      res,
    };

    await this.executeHooks("afterRequest", payloadAfter, transaction);

    if (payloadAfter.err?.length) {
      if (transaction.retryToken && payloadAfter.err.includes(transaction.retryToken)) {
        return await this.execute(definition, opts, transaction);
      }

      throw payloadAfter.err.at(-1);
    }

    return payloadAfter.res as Response;
  }

  hook<P extends HookPhase>(phase: P, handler: Hook<P>["fn"], options: Omit<Hook<P>, "fn" | "phase"> = {}) {
    const hook: Hook<P> = {
      phase,
      order: options.order ?? 0,
      handleErrors: options.handleErrors ?? true,
      fn: handler,
    };

    this.#hooks.add(hook);

    return this;
  }

  async destroy() {
    const modules = Array.from(this.#modules.values());

    await Promise.all(modules.map(module => module[symbolModuleDestroy]()));
  }
}

export default Client;
