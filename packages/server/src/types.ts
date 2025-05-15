import { Module } from "@/lib/module.js";

declare module "@graphand/core" {
  export interface TransactionCtx {
    disableCache?: boolean;
  }
}

export type ServerOptions = {
  wildcardDomain?: string;
  appName: string;
  port?: number;
};

// Define a base type for classes with constructors
export type ModuleConstructor<T extends Module = Module> = (new (_conf: any, _server: any) => T) & {
  moduleName: string | undefined;
};

export type ModuleWithConfig<T extends ModuleConstructor = ModuleConstructor> = [T, ConstructorParameters<T>[0]] | [T];

export type ServerModules<T extends ModuleConstructor[] = []> = {
  [K in keyof T]: ModuleWithConfig<T[K]>;
};
