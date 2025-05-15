import { Server } from "@/lib/server.js";
import { ModuleConstructor } from "@/types.js";

export const symbolModuleInit = Symbol("ModuleInit");
export const symbolModuleDestroy = Symbol("ModuleDestroy");

export class Module<Conf extends object = object, Deps extends ModuleConstructor[] = any[]> {
  static moduleName: string | undefined = undefined;

  dependencies: Deps | undefined = undefined;
  defaults: Conf = {} as Conf;
  server: Server;
  #conf: Conf;

  constructor(conf: Conf, server: Server) {
    if (!server) {
      throw new Error("Server is required");
    }

    this.server = server;
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
