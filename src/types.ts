import { CoreError } from "@graphand/core";

export type MiddlewareInput = {
  error?: CoreError;
  data?: any;
  fetchResponse: Response;
  retryToken: Symbol;
};

export type Middleware = (data: MiddlewareInput) => Promise<void> | void;
