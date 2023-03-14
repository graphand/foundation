import { CoreError } from "@graphand/core";

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
