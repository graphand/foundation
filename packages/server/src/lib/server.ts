import { ServerModules, ServerOptions, ModuleConstructor, ModuleWithConfig } from "@/types.js";
import { Module, symbolModuleDestroy, symbolModuleInit } from "@/lib/module.js";
import { decodeServerModule } from "@/lib/utils.js";
import { Route } from "./route.js";
import { RequestHelper } from "./request-helper.js";
const DEFAULT_OPTIONS: Partial<ServerOptions> = {
  port: 3000,
};

export class Server<T extends ModuleConstructor[] = []> {
  #options: ServerOptions;
  #serverModules: ServerModules<T>;
  #modules: Map<string, Module>;
  #modulesInitPromises: Map<string, Promise<void> | void> | undefined;
  #routes = new Set<Route>();

  constructor(options: ServerOptions = {}, modules: ServerModules<T> = [] as ServerModules<T>) {
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

  fetch(req: Request) {
    const firstRoute = this.#routes.values().next().value;

    if (!firstRoute) {
      return new Response("No routes found", { status: 404 });
    }

    const requestHelper = new RequestHelper(req);

    return firstRoute.fetch(requestHelper);
  }
}
