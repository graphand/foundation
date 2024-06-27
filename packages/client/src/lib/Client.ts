import { ClientModules, ModuleWithConfig } from "./../types";
import { ClientOptions, ModuleConstructor } from "../types";
import Module from "./Module";

class Client<T extends ModuleConstructor[]> {
  #options: ClientOptions;
  #modules: Map<string, Module>;

  constructor(modules: ClientModules<T>, options: ClientOptions = {}) {
    this.#options = options;

    // Checking there are no duplicate module names
    const moduleNames = modules.map(([moduleClass]) => moduleClass.moduleName);

    if (moduleNames.some(name => !name)) {
      throw new Error("Module names cannot be empty");
    }

    if (new Set(moduleNames).size !== moduleNames.length) {
      throw new Error("Duplicate module names are not allowed");
    }

    this.#modules = new Map(modules.map(([moduleClass, conf]) => [moduleClass.moduleName, new moduleClass(conf)]));
  }

  get options() {
    return this.#options;
  }

  get<N extends T[number]["moduleName"]>(_name: N): InstanceType<Extract<T[number], { moduleName: N }>>;
  get<M extends Module>(_name: string): M;
  get<M extends typeof Module>(_module: M): InstanceType<M>;
  get(module: string | typeof Module): Module | null {
    const name = String(typeof module === "string" ? module : (module.constructor as any)?.moduleName);
    return this.#modules.get(name) || null;
  }

  use<U extends ModuleConstructor>(
    moduleClass: ModuleWithConfig<U>[0],
    conf: ModuleWithConfig<U>[1],
  ): Client<[...T, U]> {
    if (!moduleClass.moduleName) {
      throw new Error("Module name is required");
    }

    if (this.#modules.has(moduleClass.moduleName)) {
      throw new Error(`Module ${moduleClass.moduleName} is already registered`);
    }

    this.#modules.set(moduleClass.moduleName, new moduleClass(conf));

    return this as unknown as Client<[...T, U]>;
  }
}

export default Client;
