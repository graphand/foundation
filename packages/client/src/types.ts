import { CoreErrorDefinition } from "@graphand/core";
import Module from "./lib/Module";
import Client from "./lib/Client";

// Define a base type for classes with constructors
export type ModuleConstructor<T extends Module = Module<any, any[]>> = (new (_conf: any, _client: Client) => T) & {
  moduleName: string | undefined;
};

export type InferModuleDependencies<T extends Module> = T extends Module<any, infer Deps> ? Deps : never;

// Define the ModuleWithConfig type
export type ModuleWithConfig<T extends ModuleConstructor = ModuleConstructor> = [T, ConstructorParameters<T>[0]] | [T];

export type ClientModules<T extends ModuleConstructor[] = []> = {
  [K in keyof T]: ModuleWithConfig<T[K]>;
};

// Define the ClientOptions type
export type ClientOptions = {
  project: string | null;
  endpoint?: string;
  ssl?: boolean;
  maxRetries?: number;
  headers?: Record<string, string>;
};

export type SubjectObserver<T> = (_value: T, _previousValue?: T) => void;

export type ClientErrorDefinition = CoreErrorDefinition & {
  data?: Record<string, any>;
};

export type HookPhase = "beforeRequest" | "afterRequest";

export type HookCallbackArgs<P extends HookPhase> = P extends "beforeRequest"
  ? {
      req: Request;
      err: Array<Error | symbol> | undefined;
      transaction: Transaction;
    }
  : HookCallbackArgs<"beforeRequest"> & {
      res: Response | undefined;
    };

export type Hook<P extends HookPhase = HookPhase> = {
  phase: P;
  order?: number;
  handleErrors?: boolean;
  fn: (this: Client, args: HookCallbackArgs<P>) => void;
};

export type Transaction = {
  retryToken?: symbol;
  abortToken?: symbol;
  retries: number;
};

export type ModelUpdaterEvent = {
  ids: Array<string>;
  operation: "create" | "update" | "delete" | "fetch";
};
