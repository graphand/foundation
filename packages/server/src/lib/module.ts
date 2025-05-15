import { Server } from "@/lib/server.js";
import { ModuleConstructor } from "@/types.js";
import { z } from "zod";

export const symbolModuleInit = Symbol("ModuleInit");
export const symbolModuleDestroy = Symbol("ModuleDestroy");

export class Module<TShape extends z.ZodRawShape = z.ZodRawShape, Deps extends ModuleConstructor[] = any[]> {
  static moduleName: string | undefined = undefined;

  schema?: z.ZodObject<TShape>;
  dependencies: Deps | undefined = undefined;
  defaults: Partial<z.infer<z.ZodObject<TShape>>> = {} as Partial<z.infer<z.ZodObject<TShape>>>;
  server: Server;
  #conf: z.infer<z.ZodObject<TShape>>;

  constructor(conf: z.infer<z.ZodObject<TShape>>, server: Server) {
    if (!server) {
      throw new Error("Server is required");
    }

    this.#conf = conf;
    this.server = server;
  }

  parse() {
    if (this.schema) {
      return this.schema.parse(this.#conf);
    }

    return this.#conf;
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
