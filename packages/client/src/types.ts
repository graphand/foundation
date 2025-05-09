import {
  CoreErrorDefinition,
  InferModel,
  ModelInstance,
  ModelList,
  Model,
  PropertyTypes,
  PropertyDefinitionGeneric,
  GDXDatamodels,
  Models,
  ModelData,
} from "@graphand/core";
import { Module } from "./lib/Module.js";
import { Client } from "./lib/Client.js";
import { ClientAdapter } from "./lib/ClientAdapter.js";

declare module "@graphand/core" {
  export interface SerializerPropertiesMap<F extends PropertyDefinitionGeneric<PropertyTypes>> {
    data: SerializerPropertiesMap<F>["json"];
  }

  export interface TransactionCtx {
    disableCache?: boolean;
    formData?: FormData;
    uploadId?: string;
    query?: Record<string, string>;
    onRequest?: (_req: RequestInit) => RequestInit;
    onUrl?: (_url: string) => string;
  }

  export interface Model {
    subscribe: <T extends ModelInstance>(
      this: T,
      _observer: (_previousData: ReturnType<T["getData"]>, _event: ModelUpdaterEvent) => void,
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
    export function hydrateAndCache<T extends typeof Model>(this: T, _data?: Partial<ModelData<T>>): ModelInstance<T>;
  }

  export interface ModelList<T extends typeof Model> extends Array<ModelInstance<T>> {
    subscribe: <T extends ModelList<typeof Model>>(
      this: T,
      _observer: SubjectObserver<ModelUpdaterEvent>,
      _opts?: {
        onLoadingChange?: (_loading: boolean) => void; // Handle loading state changes
        onError?: (_error: Error) => void; // Handle errors in list reload
        noReload?: boolean; // Do not reload the list when an item is updated or deleted. By default, the list is reloaded.
        autoRemove?: boolean; // Automatically remove the item from the list when it is deleted in store (otherwise, the item will be deleted after a reload)
        reload?: () => Promise<void>; // Custom reload function (by default, it calls list.reload())
      },
    ) => ReturnType<ClientAdapter<InferModelFromList<T>>["subscribe"]>;
    getKey: () => string;
    getMostRecent: () => ModelInstance<T> | undefined;
    getCurrentState: () => ModelListState;
    hasStateChanged: (_oldState: ModelListState, _newState: ModelListState) => boolean;
  }

  export interface PromiseModel<T extends typeof Model> {
    cached: ModelInstance<T>;
  }

  export interface PromiseModelList<T extends typeof Model> {
    cached: ModelList<T>;
    cachedPartial: ModelList<T>;
  }
}

export type InferModelFromList<T extends ModelList<typeof Model>> = T extends ModelList<infer M> ? M : typeof Model;

// Define a base type for classes with constructors
export type ModuleConstructor<T extends Module = Module> = (new (_conf: any, _client: Client) => T) & {
  moduleName: string | undefined;
};

// Define the ModuleWithConfig type
export type ModuleWithConfig<T extends ModuleConstructor = ModuleConstructor> = [T, ConstructorParameters<T>[0]] | [T];

export type ClientModules<T extends ModuleConstructor[] = []> = {
  [K in keyof T]: ModuleWithConfig<T[K]>;
};

// Define the ClientOptions type
export type ClientOptions<D extends GDXDatamodels = {}> = { datamodels?: D } & (
  | {
      project: string | null;
      url?: string;
    }
  | {
      url: string;
      project?: string | null;
    }
) & {
    endpoint?: string;
    ssl?: boolean;
    maxRetries?: number;
    environment?: string;
    accessToken?: string;
    headers?: Record<string, string>;
    disableCache?: boolean | Array<string>;
    disableStore?: boolean | Array<string>;
  };

export type SubjectObserver<T> = (_value: T, _previousValue?: T) => void;

export type ClientErrorDefinition = CoreErrorDefinition & {
  data?: Record<string, any>;
};

export type FetchErrorDefinition = CoreErrorDefinition & {
  res?: Response;
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

export type Hook<P extends HookPhase = HookPhase, C extends Client = Client> = {
  phase: P;
  order?: number;
  handleErrors?: boolean;
  fn: (this: C, _args: HookCallbackArgs<P>) => void;
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

export type TransformFunction = (_value: any, _key?: string | number) => any;

export interface TraverseOptions {
  preTransformObject?: (_obj: Record<string, any>) => Record<string, any> | null;
  preTransformArray?: (_arr: any[]) => any[] | null;
  transform?: TransformFunction;
}

export type WithConfiguration<M extends typeof Model, Configuration> = M & {
  configuration: Configuration;
};

/**
 * Infers the model type returned by Client.getModel based on the input parameter
 */
export type InferClientModel<C extends Client<any, any, any>, Input> =
  C extends Client<infer D extends GDXDatamodels, any, infer M>
    ? Input extends typeof Model
      ? Input["configuration"]["slug"] extends keyof D
        ? WithConfiguration<Input, D[Input["configuration"]["slug"]]>
        : Input
      : Input extends string
        ? Input extends Extract<M[number]["configuration"]["slug"], string>
          ? Input extends keyof D
            ? WithConfiguration<Extract<M[number], { configuration: { slug: Input } }>, D[Input]>
            : Extract<M[number], { configuration: { slug: Input } }>
          : Input extends keyof D | keyof Models
            ? Input extends keyof Models
              ? Input extends keyof D
                ? WithConfiguration<Models[Input & keyof Models], D[Input]>
                : Models[Input & keyof Models]
              : Input extends keyof D
                ? WithConfiguration<typeof Model, D[Input]>
                : typeof Model
            : typeof Model
        : never
    : never;
