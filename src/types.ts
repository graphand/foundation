import "@graphand/core/global";
import { CoreError } from "@graphand/core";

declare module "@graphand/core" {
  export class Model {
    static subscribe: (cb: (event: ModelUpdaterEvent) => void) => () => void;
    subscribe: (cb: () => void) => () => void;
  }

  export class ModelList<T extends Model> extends Array<T> {
    subscribe: (cb: () => void) => () => void;
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
  operation: "create" | "update" | "delete" | "localUpdate" | "fetch";
};

export type Middleware = (data: MiddlewareInput) => Promise<void> | void;
