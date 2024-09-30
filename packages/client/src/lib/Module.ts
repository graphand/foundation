import { InferModuleDependencies, ModuleConstructor } from "@/types.ts";
import { Client } from "./Client.ts";

export const symbolModuleInit = Symbol("ModuleInit");
export const symbolModuleDestroy = Symbol("ModuleDestroy");

export class Module<Conf extends object = object, Deps extends ModuleConstructor[] = ModuleConstructor[]> {
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

  get moduleName(): string | undefined {
    const c = this.constructor as typeof Module;
    return c.moduleName;
  }

  client<T extends Module>(this: T): Client<InferModuleDependencies<T>> {
    return this.#client as any;
  }

  [symbolModuleInit](): Promise<void> | void {}
  [symbolModuleDestroy](): Promise<void> | void {}
}
