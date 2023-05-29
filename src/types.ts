import "@graphand/core/global";
import type {
  CoreError,
  CoreErrorDefinition,
  AuthMethods,
  HookPhase,
  ControllerDefinition,
} from "@graphand/core";
import Client from "./lib/Client";

declare module "@graphand/core" {
  export class Model {
    static realtime: () => void;
    static clearCache: () => void;
    static subscribe: (cb: (event: ModelUpdaterEvent) => void) => () => void;
    subscribe: (cb: (event: ModelUpdaterEvent) => void) => () => void;
  }

  export class ModelList<T extends Model> extends Array<T> {
    subscribe: (
      cb: (event: ModelUpdaterEvent) => void,
      cbLoading?: (loading: boolean) => void
    ) => () => void;
  }

  export class Media extends Model {
    getUrl: (opts?: {
      w?: string | number;
      h?: string | number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    }) => string;
  }
}

export type ModelUpdaterEvent = {
  ids: Array<string>;
  operation: "create" | "update" | "delete" | "fetch";
};

export type ClientOptions = {
  endpoint?: string;
  project?: string;
  environment?: string;
  accessToken?: string;
  refreshToken?: string;
  sockets?: Array<SocketScope>;
  handleAuthRedirect?: boolean;
  authControllersMap?: AuthControllersMap;
};

export type SocketScope = "project" | "global";

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

export type ClientExecutorCtx = {
  sendAsFormData?: boolean;
};

export type FormSocketEvent = {};

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
