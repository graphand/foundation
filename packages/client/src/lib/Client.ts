import {
  ClientModules,
  Hook,
  HookCallbackArgs,
  HookPhase,
  ModuleWithConfig,
  SubjectObserver,
  Transaction,
  ClientOptions,
  ModuleConstructor,
  InferClientModel,
} from "@/types.js";
import { Module, symbolModuleDestroy, symbolModuleInit } from "./Module.js";
import {
  Account,
  Adapter,
  Controller,
  controllerCurrentAccount,
  controllerFunctionRun,
  ControllerInput,
  controllerMediaPrivate,
  controllerMediaPublic,
  CoreError,
  ErrorCodes,
  GDXDatamodels,
  IdentityTypes,
  InferControllerInput,
  isObjectId,
  JSONObject,
  Media,
  MediaTransformOptions,
  Model,
  ModelInstance,
  Models,
  TransactionCtx,
} from "@graphand/core";
import { ClientAdapter } from "./ClientAdapter.js";
import { BehaviorSubject } from "./BehaviorSubject.js";
import { decodeClientModule, parseErrorFromJSON } from "./utils.js";
import { FetchError } from "./FetchError.js";
import { __CLIENT_VERSION__ } from "@/index.js";

const DEFAULT_OPTIONS: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  ssl: true,
  maxRetries: 3,
};

export class Client<
  D extends GDXDatamodels = {},
  T extends ModuleConstructor[] = ModuleConstructor[],
  M extends (typeof Model)[] = [],
> {
  #options: BehaviorSubject<ClientOptions<D>>;
  #clientModules: ClientModules<T>;
  #modules: Map<string, Module>;
  #modulesInitPromises: Map<string, Promise<void> | void> | undefined;
  #hooks: Set<Hook>;
  #adapterClass: typeof ClientAdapter | undefined;

  constructor(
    options: ClientOptions<D> = { project: null },
    modules: ClientModules<T> = [] as ClientModules<T>,
    models: M = [] as unknown as M,
  ) {
    this.#options = new BehaviorSubject(options || { ...DEFAULT_OPTIONS, project: null });
    this.#clientModules = modules;

    // Registering models
    models.forEach(m => this.useModel(m));

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
    modules.forEach(m => this.useModule(...m));

    // Resolving dependencies
    for (const module of this.#modules.values()) {
      this.resolveDependencies(module);
    }

    // Initializing modules
    this.init().catch(() => null);
  }

  subscribeOptions(observer: SubjectObserver<ClientOptions<D>>) {
    return this.#options.subscribe(observer);
  }

  setOptions(options: Partial<ClientOptions<D>>) {
    this.#options.next({ ...this.#options.getValue(), ...options });
  }

  get options(): ClientOptions<D> {
    const options = this.#options.getValue();
    return { ...DEFAULT_OPTIONS, ...options } as ClientOptions<D>;
  }

  get<C extends Client, N extends T[number]["moduleName"]>(
    this: C,
    _name: N,
  ): InstanceType<Extract<T[number], { moduleName: N }>> & { client: C };
  get<C extends Client, M extends Module>(this: C, _name: string): M & { client: C };
  get<C extends Client, M extends ModuleConstructor>(this: C, _module: M): InstanceType<M> & { client: C };
  get<C extends Client>(this: C, module: string | typeof Module): Module & { client: C } {
    const name = String(typeof module === "string" ? module : module.moduleName);
    const res = this.#modules.get(name);

    if (!res) {
      throw new Error(`Module ${name} not found`);
    }

    return res as Module & { client: C };
  }

  useModule<U extends ModuleConstructor>(...m: ModuleWithConfig<U>): Client<D, [...T, U], M> {
    const { moduleClass, conf } = decodeClientModule(m);

    if (!moduleClass.moduleName) {
      throw new Error("Module name is required");
    }

    if (this.#modules.has(moduleClass.moduleName)) {
      throw new Error(`Module ${moduleClass.moduleName} is already registered`);
    }

    const module = new moduleClass(conf, this as unknown as Client);
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

    return this as unknown as Client<D, [...T, U], M>;
  }

  useModel<U extends typeof Model>(model: U): Client<D, T, [...M, U]> {
    this.model(model);

    return this as Client<D, T, [...M, U]>;
  }

  resolveDependencies(module: Module) {
    if (!module.dependencies) {
      return;
    }

    for (const dependency of module.dependencies as ModuleConstructor[]) {
      if (dependency.moduleName && !this.#modules.has(dependency.moduleName)) {
        this.useModule(dependency);
      }
    }
  }

  init() {
    if (!this.#modulesInitPromises) {
      const promises = new Map();

      const _initModule = async (module: Module) => {
        if (!module.moduleName) {
          throw new Error("Module name is required");
        }

        if (promises.has(module.moduleName) && promises.get(module.moduleName) !== null) {
          return;
        }

        promises.set(module.moduleName, null);

        (module.dependencies as ModuleConstructor[])?.forEach(dep => {
          if (!promises.has(dep.moduleName)) {
            const m = (this as any).get(dep.moduleName);
            m && _initModule(m);
          }
        });

        promises.set(module.moduleName, module[symbolModuleInit]());
      };

      for (const module of this.#modules.values()) {
        _initModule(module);
      }

      this.#modulesInitPromises = promises;
    }

    return Promise.all(this.#modulesInitPromises.values());
  }

  getProject() {
    const { project, url } = this.options;

    if (url) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      const [project] = hostname.split(".");

      if (isObjectId(project)) {
        return project;
      }
    }

    if (project) {
      return project;
    }

    return null;
  }

  getEndpoint() {
    const { endpoint, url } = this.options;

    if (url) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      const [project, ...endpoint] = hostname.split(".");

      if (isObjectId(project)) {
        return endpoint.join(".");
      }

      return hostname;
    }

    if (endpoint) {
      return endpoint;
    }

    return null;
  }

  getProtocol() {
    const { ssl, url } = this.options;

    if (url) {
      const urlObj = new URL(url);
      return urlObj.protocol;
    }

    if (ssl !== undefined) {
      return ssl ? "https:" : "http:";
    }

    return "http:";
  }

  getBaseUrl(protocol?: string, excludeEnvironment = false): string {
    const project = this.getProject();
    const endpoint = this.getEndpoint();

    if (!endpoint) {
      throw new Error("Endpoint is required in client options");
    }

    protocol ??= this.getProtocol();

    const domain = project ? `${project}.${endpoint}` : endpoint;

    // Add environment prefix if needed
    const { environment } = this.options;
    const shouldIncludeEnv = environment && !excludeEnvironment;
    const finalDomain = shouldIncludeEnv ? `${environment}-${domain}` : domain;

    return `${protocol}//${finalDomain}`;
  }

  buildUrl(controller: Controller, opts: { params?: Record<string, string>; query?: JSONObject }) {
    let path: string = controller.path;

    if (opts.params) {
      path = controller.path.replace(/:([\w|*]+)(\?)?/g, (_, param) => {
        if (param.startsWith("*")) {
          // Handle wildcard parameters
          return opts.params?.[param.substring(1)] ? encodeURIComponent(String(opts.params[param.substring(1)])) : "";
        }

        // Handle regular parameters
        return opts.params?.[param] ? encodeURIComponent(String(opts.params[param])) : "";
      });
    }

    const base = this.getBaseUrl();

    const url = new URL(path, base);

    if (opts.query) {
      Object.entries(opts.query).forEach(([key, value]) => {
        if (!value) {
          return;
        }

        if (value === true) {
          url.searchParams.set(key, "1");
        } else {
          url.searchParams.set(key, String(value));
        }
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
        await hook.fn.call(this as unknown as Client, payload);
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
          await h.fn.call(this as unknown as Client, payload);
        } catch (e) {
          payload.err ??= [];
          payload.err.push(e as Error);
        }
      }, Promise.resolve());
    }
  }

  getAdapterClass(baseClass?: typeof Adapter): typeof ClientAdapter {
    if (!this.#adapterClass) {
      this.setAdapterClass((baseClass as typeof ClientAdapter) ?? ClientAdapter);
    }

    return this.#adapterClass as typeof ClientAdapter;
  }

  setAdapterClass(adapterClass: typeof ClientAdapter) {
    this.#adapterClass = class extends adapterClass {} as typeof ClientAdapter;
    this.#adapterClass.client = this as unknown as Client;

    return this;
  }

  declareGlobally() {
    // @ts-expect-error - __GLOBAL_ADAPTER__ is used by @graphand/core to get the global adapter if no adapter is found on a model
    globalThis.__GLOBAL_ADAPTER__ = this.getAdapterClass();
    // @ts-expect-error - __GLOBAL_CLIENT__
    globalThis.__GLOBAL_CLIENT__ = this;
  }

  static getGlobal() {
    // @ts-expect-error - __GLOBAL_CLIENT__
    return globalThis.__GLOBAL_CLIENT__ as Client;
  }

  model<I extends typeof Model | string | keyof D | keyof Models>(input: I): InferClientModel<this, I> {
    const model = Model.getClass(input as any, this.getAdapterClass()) as InferClientModel<this, I>;
    model.configuration.loadDatamodel ??= true;
    return model;
  }

  // alias for model
  getModel = this.model;

  async me(useClaimToken = true): Promise<ModelInstance<InferClientModel<this, "accounts">> | null> {
    await this.init();

    if (!this.options.accessToken) {
      return null;
    }

    const model = this.model("accounts") as typeof Account;

    if (useClaimToken) {
      try {
        const parts = this.options.accessToken.split(".");
        if (!parts[1]) return null;
        const payload = JSON.parse(atob(parts[1]));

        if (payload.type === IdentityTypes.ACCOUNT && payload.id) {
          return model.get(payload.id) as any;
        }
      } catch (e) {
        throw new Error(`Unable to decode claim access token: ${(e as Error).message}`);
      }
    }

    const res = await this.execute(controllerCurrentAccount);

    const { data } = await res.json();

    return model.hydrateAndCache(data) as any;
  }

  async execute<C extends Controller<ControllerInput> = Controller<ControllerInput>>(
    controller: C,
    opts: {
      params?: NonNullable<InferControllerInput<C>>["params"];
      query?: NonNullable<InferControllerInput<C>>["query"];
      data?: NonNullable<InferControllerInput<C>>["data"];
      ctx?: TransactionCtx;
      init?: RequestInit;
      maxRetries?: number;
    } = {},
    transaction?: Transaction,
  ): Promise<Response> {
    if (controller.secured && !this.options.accessToken) {
      throw new Error("Access token is required");
    }

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

    const params = opts.params as Record<string, string>;
    const query = Object.assign({}, opts.query, opts.ctx?.query);

    let url = this.buildUrl(controller, { params, query });

    let init: RequestInit = Object.assign({}, opts.init);
    init.headers = Object.assign({}, init.headers, {
      "Client-Version": __CLIENT_VERSION__,
    }); // Cloning headers

    if (!init.method) {
      const order = ["put", "post", "patch", "delete", "get", "options"] as Array<
        (typeof controller)["methods"][number]
      >;
      const method = order.filter(m => controller.methods.includes(m)).at(0) || "get";

      init.method = method.toUpperCase();
    }

    if (this.options.headers) {
      Object.assign(init.headers, this.options.headers);
    }

    if (this.options.accessToken && (!init.headers || !("Authorization" in init.headers))) {
      Object.assign(init.headers, { Authorization: `Bearer ${this.options.accessToken}` });
    }

    if (this.options.environment && (!init.headers || !("Content-Environment" in init.headers))) {
      Object.assign(init.headers, { "Content-Environment": this.options.environment });
    }

    const _isFormData = init.body instanceof FormData || opts?.ctx?.formData;
    if (!_isFormData && (!init.headers || !("Content-Type" in init.headers))) {
      Object.assign(init.headers, { "Content-Type": "application/json" });
    }

    if (opts.data) {
      init.body ??= JSON.stringify(opts.data);
    }

    if (typeof opts.ctx?.onUrl === "function") {
      url = opts.ctx.onUrl(url);
    }

    if (typeof opts.ctx?.onRequest === "function") {
      init = opts.ctx.onRequest(init);
    }

    if (!init) {
      throw new Error(`Invalid request init: ${init}`);
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
        return await this.execute(controller, opts, transaction);
      }

      throw payloadBefore.err.at(-1);
    }

    try {
      res = await fetch(request);

      if (!res) {
        throw new Error("Response is null");
      }

      if (!res.ok) {
        const type = res.headers.get("content-type");
        if (type?.includes("application/json")) {
          const { error, exceptions } = await res.json();

          if (error) {
            throw parseErrorFromJSON(error, res);
          }

          if (exceptions?.length) {
            throw parseErrorFromJSON(exceptions[0], res);
          }

          throw new FetchError({ message: "Unknown fetch error", res });
        }

        if (type?.includes("text/plain")) {
          const data = await res.text();
          throw new FetchError({ message: data, res });
        }

        throw new FetchError({ message: "Unknown fetch error", res });
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
        return await this.execute(controller, opts, transaction);
      }

      throw payloadAfter.err.at(-1);
    }

    return payloadAfter.res as Response;
  }

  hook<P extends HookPhase, C extends Client>(
    this: C,
    phase: P,
    handler: Hook<P, C>["fn"],
    options: Omit<Hook<P, C>, "fn" | "phase"> = {},
  ) {
    const hook: Hook<P, C> = {
      phase,
      order: options.order ?? 0,
      handleErrors: options.handleErrors ?? false,
      fn: handler,
    };

    this.#hooks.add(hook as unknown as Hook);

    return this;
  }

  removeHook<P extends HookPhase>(phase: P, handler: Hook<P>["fn"]) {
    const hook = Array.from(this.#hooks).find(h => h.phase === phase && h.fn === handler);
    if (!hook) {
      throw new Error("Hook not found");
    }

    this.#hooks.delete(hook);
  }

  async destroy() {
    const modules = Array.from(this.#modules.values());

    await Promise.all(modules.map(module => module[symbolModuleDestroy]()));
  }

  buildMediaUrl(
    idOrMedia: string | ModelInstance<typeof Media>,
    opts?: {
      private?: boolean;
      transform?: MediaTransformOptions;
    },
  ): string {
    const id = typeof idOrMedia === "string" ? idOrMedia : idOrMedia._id;

    if (!id) {
      throw new Error("Media or id is required");
    }

    const mediaPrivate = opts?.private ?? (typeof idOrMedia === "string" ? false : idOrMedia.private);

    const controller = mediaPrivate ? controllerMediaPrivate : controllerMediaPublic;

    return this.buildUrl(controller, {
      params: { id },
      query: opts?.transform as Record<string, string>,
    });
  }

  clone(options: Partial<ClientOptions<D>> = {}) {
    return new Client<D, T, M>({ ...this.options, ...options } as ClientOptions<D>, this.#clientModules);
  }

  runFunction(
    idOrName: string,
    opts: {
      path?: string;
      data?: JSONObject;
      query?: JSONObject;
      init?: RequestInit;
      maxRetries?: number;
    },
  ) {
    return this.execute(controllerFunctionRun, {
      params: { id: idOrName },
      data: opts?.data,
      query: opts?.query,
      init: opts?.init,
      maxRetries: opts?.maxRetries,
      ctx: {
        onUrl: url => {
          const _url = new URL(url);

          if (opts.path) {
            // Join the pathname with the path
            _url.pathname = [_url.pathname, opts.path].join("/").replace(/\/+/g, "/");
          }

          return _url.toString();
        },
      },
    });
  }
}
