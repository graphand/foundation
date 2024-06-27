import "@graphand/core/global";
import type {
  CoreErrorDefinition,
  AuthMethods,
  HookPhase,
  ControllerDefinition,
  ModelInstance,
  MediaTransformOptions,
  AuthProviders,
  AuthProviderCredentials,
  AuthMethodOptions,
} from "@graphand/core";
import Client from "./lib/Client";

declare module "@graphand/core" {
  export class Model {
    static realtime: () => void;
    static clearCache: () => void;
    static subscribe: (cb: (event: ModelUpdaterEvent) => void) => () => void;
    static getClient: () => Client;
    subscribe: (cb: (event: ModelUpdaterEvent) => void) => () => void;
  }

  export class ModelList<T extends typeof Model> extends Array<
    ModelInstance<T>
  > {
    subscribe: (
      cb: (event: ModelUpdaterEvent) => void,
      cbLoading?: (loading: boolean) => void
    ) => () => void;
  }

  export class Media extends Model {
    getUrl: (opts?: MediaTransformOptions) => string;
  }

  export interface TransactionCtx {
    sendAsFormData?: boolean;
  }
}

export type SubjectObserver<T> = (value: T, previousValue: T) => void;

export type ModelUpdaterEvent = {
  ids: Array<string>;
  operation: "create" | "update" | "delete" | "fetch";
};

export type ClientOptions = {
  endpoint?: string;
  scope?: string;
  environment?: string;
  accessToken?: string;
  refreshToken?: string;
  socket?: boolean;
  handleAuthRedirect?: boolean;
  authControllersMap?: AuthControllersMap;
  headers?: Record<string, string>;
  ssl?: boolean;
};

export type LoginData<
  P extends AuthProviders = AuthProviders.LOCAL,
  M extends AuthMethods = AuthMethods.WINDOW
> = {
  provider?: P;
  method?: M;
  credentials?: AuthProviderCredentials<P>;
  options?: AuthMethodOptions<M>;
};

export type FetchErrorDefinition = CoreErrorDefinition & {
  type?: string;
};

export type AuthControllersMap = Map<
  AuthMethods,
  (
    url: string,
    client: Client
  ) => Promise<{
    accessToken?: string;
    refreshToken?: string;
  }>
>;

export type ClientHook<P extends HookPhase, C extends ControllerDefinition> = {
  phase: P;
  fn: (input: ClientHookPayload<P>) => Promise<void> | void;
  controller?: C;
  order?: number;
};

export type ExecuteOpts = {
  path?: { [key: string]: string };
  query?: any;
  body?: any;
  sendAsFormData?: boolean;
};

export type ClientHookPayload<P extends HookPhase> = P extends "before"
  ? {
      controller: ControllerDefinition;
      retryToken: Symbol;
      opts: ExecuteOpts;
      err?: Array<Error | Symbol>;
    }
  : P extends "after"
  ? ClientHookPayload<"before"> & {
      data: any;
      fetchResponse: Response;
    }
  : never;
