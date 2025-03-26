import { Client, ModuleConstructor } from "@/index.js";

export const symbolModuleInit = Symbol("ModuleInit");
export const symbolModuleDestroy = Symbol("ModuleDestroy");

export class Module<Conf extends object = object, Deps extends ModuleConstructor[] = any[]> {
  static moduleName: string | undefined = undefined;

  dependencies: Deps | undefined = undefined;
  defaults: Conf = {} as Conf;
  client: Client;
  #conf: Conf;

  constructor(conf: Conf, client: Client) {
    if (!client) {
      throw new Error("Client is required");
    }

    this.client = client;
    this.#conf = conf;
  }

  get conf() {
    return { ...this.defaults, ...this.#conf };
  }

  get moduleName(): string | undefined {
    const c = this.constructor as typeof Module;
    return c.moduleName;
  }

  [symbolModuleInit](): Promise<void> | void {}
  [symbolModuleDestroy](): Promise<void> | void {}
}
