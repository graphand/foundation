import "@graphand/core/global";
import type { CoreError, CoreErrorDefinition } from "@graphand/core";

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
}

export type MiddlewareInput = {
  error?: CoreError;
  data?: any;
  fetchResponse: Response;
  retryToken: Symbol;
};

export type ModelUpdaterEvent = {
  ids: Array<string>;
  operation: "create" | "update" | "delete" | "fetch";
};

export type Middleware = (data: MiddlewareInput) => Promise<void> | void;

export type ClientOptions = {
  endpoint?: string;
  project?: string;
  environment?: string;
  accessToken?: string;
  refreshToken?: string;
  sockets?: Array<SocketScope>;
};

export type SocketScope = "project" | "global";

export type FetchErrorDefinition = CoreErrorDefinition & {
  type?: string;
};
