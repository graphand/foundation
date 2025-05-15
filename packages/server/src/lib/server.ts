import { ServerModules, ServerOptions, ModuleConstructor, ModuleWithConfig } from "@/types.js";
import { Module, symbolModuleDestroy, symbolModuleInit } from "@/lib/module.js";
import { decodeServerModule } from "@/lib/utils.js";
import { Route } from "./route.js";
import { RequestHelper } from "./request-helper.js";

const DEFAULT_OPTIONS: Partial<ServerOptions> = {
  port: 3000,
};

export class Server<T extends ModuleConstructor[] = []> {
  #appName: string;
  #options: ServerOptions;
  #serverModules: ServerModules<T>;
  #modules: Map<string, Module>;
  #modulesInitPromises: Map<string, Promise<void> | void> | undefined;
  #routes = new Set<Route>();

  constructor(options: ServerOptions, modules: ServerModules<T> = [] as ServerModules<T>) {
    if (!options?.appName) {
      throw new Error("appName is required");
    }

    this.#appName = options.appName;

    this.#options = { ...DEFAULT_OPTIONS, ...options };
    this.#serverModules = modules;

    // Checking there are no duplicate module names
    const moduleNames = modules.map(m => decodeServerModule(m).moduleClass.moduleName);

    if (moduleNames.some(name => !name)) {
      throw new Error("Module names cannot be empty");
    }

    if (new Set(moduleNames).size !== moduleNames.length) {
      throw new Error("Duplicate module names are not allowed");
    }

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

  get appName() {
    return this.#appName;
  }

  get options() {
    return this.#options;
  }

  useModule<U extends ModuleConstructor>(...m: ModuleWithConfig<U>): Server<[...T, U]> {
    const { moduleClass, conf } = decodeServerModule(m);

    if (!moduleClass.moduleName) {
      throw new Error("Module name is required");
    }

    if (this.#modules.has(moduleClass.moduleName)) {
      throw new Error(`Module ${moduleClass.moduleName} is already registered`);
    }

    const module = new moduleClass(conf, this as unknown as Server);
    module.parse();
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

    return this as unknown as Server<[...T, U]>;
  }

  checkModule<U extends ModuleConstructor>(module: U): Server<[...T, U]> {
    if (!module.moduleName) {
      throw new Error("Module name is required");
    }

    if (!this.#modules.has(module.moduleName)) {
      throw new Error(`Module ${module.moduleName} is not registered`);
    }

    return this as unknown as Server<[...T, U]>;
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

  destroy() {
    const modules = Array.from(this.#modules.values());

    return Promise.all(modules.map(module => module[symbolModuleDestroy]()));
  }

  async start() {
    await this.init();
    const server = this;

    Bun.serve({
      port: this.options.port,
      fetch(req) {
        return server.fetch(req);
      },
    });
  }

  clone(options: Partial<ServerOptions> = {}) {
    return new Server<T>({ ...this.options, ...options }, this.#serverModules);
  }

  addRoute(route: Route) {
    this.#routes.add(route);
  }

  get<C extends Server<any>, N extends T[number]["moduleName"]>(
    this: C,
    _name: N,
  ): InstanceType<Extract<T[number], { moduleName: N }>> & { server: C };
  get<C extends Server<any>, M extends Module>(this: C, _name: string): M & { server: C };
  get<C extends Server<any>, M extends ModuleConstructor>(this: C, _module: M): InstanceType<M> & { server: C };
  get<C extends Server<any>>(this: C, module: string | typeof Module): Module & { server: C } {
    const name = String(typeof module === "string" ? module : module.moduleName);
    const res = this.#modules.get(name);

    if (!res) {
      throw new Error(`Module ${name} not found`);
    }

    return res as Module & { server: C };
  }

  fetch(req: Request) {
    const firstRoute = this.#routes.values().next().value;

    if (!firstRoute) {
      return new Response("No routes found", { status: 404 });
    }

    const requestHelper = new RequestHelper(req, this);

    return firstRoute.fetch(requestHelper);
  }
}
