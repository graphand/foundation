import { InferModuleDependencies, ModuleConstructor } from "../types";
import Client from "./Client";

export const symbolModuleInit = Symbol("ModuleInit");
export const symbolModuleDestroy = Symbol("ModuleDestroy");

class Module<Conf extends object = object, Deps extends ModuleConstructor[] = ModuleConstructor[]> {
  static moduleName: string | undefined = undefined;

  defaults: Conf = {} as Conf;
  dependencies: Deps | undefined = undefined;

  #conf: Conf;
  #client: Client;

  constructor(conf: Conf, client: Client) {
    if (!client) {
      throw new Error("Client is required");
    }

    this.#conf = conf;
    this.#client = client;
  }

  get conf() {
    return { ...this.defaults, ...this.#conf };
  }

  client<T extends Module>(this: T): Client<InferModuleDependencies<T>> {
    return this.#client as any;
  }

  [symbolModuleInit](): Promise<void> | void {}
  [symbolModuleDestroy](): Promise<void> | void {}
}

export default Module;
