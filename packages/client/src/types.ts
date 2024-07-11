import { CoreErrorDefinition, InferModel, ModelInstance } from "@graphand/core";
import { Module } from "./lib/Module";
import { Client } from "./lib/Client";
import { ModelList } from "@graphand/core";
import { Model } from "@graphand/core";
import { ClientAdapter } from "./lib/ClientAdapter";

declare module "@graphand/core" {
  export interface TransactionCtx {
    disableCache?: boolean;
  }

  export interface Model {
    subscribe: <T extends ModelInstance>(
      this: T,
      _observer: SubjectObserver<ModelUpdaterEvent>,
    ) => ReturnType<ClientAdapter<InferModel<T>>["subscribe"]>;
    __fetchedAt?: Date;
    __getAge: () => number;
  }

  export namespace Model {
    export function subscribe<T extends typeof Model>(
      this: T,
      _observer: SubjectObserver<ModelUpdaterEvent>,
    ): ReturnType<ClientAdapter<T>["subscribe"]>;
    export function clearCache<T extends typeof Model>(this: T): T;
    export function getClient<T extends typeof Model>(this: T): Client;
  }

  export interface ModelList<T extends typeof Model> extends Array<ModelInstance<T>> {
    subscribe: <T extends ModelList<typeof Model>>(
      this: T,
      _observer: SubjectObserver<ModelUpdaterEvent>,
      _opts?: {
        onLoadingChange?: (_loading: boolean) => void;
        onError?: (_error: Error) => void;
        noReload?: boolean;
      },
    ) => ReturnType<ClientAdapter<InferModelFromList<T>>["subscribe"]>;
    getKey: () => string;
    getMostRecent: () => ModelInstance<T> | undefined;
    getCurrentState: () => ModelListState;
    hasStateChanged: (_oldState: ModelListState, _newState: ModelListState) => boolean;
  }
}

export type InferModelFromList<T extends ModelList<typeof Model>> = T extends ModelList<infer M> ? M : typeof Model;

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
  accessToken?: string;
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
  fn: (this: Client, _args: HookCallbackArgs<P>) => void;
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

export type ModelListState = {
  lastId?: string;
  length?: number;
  lastAge?: number;
  key: string;
};
