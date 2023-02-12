import { CoreError } from "@graphand/core";

export type MiddlewareData = {
  err?: CoreError;
  res?: any;
  fetchResponse: Response;
};

export type Middleware = (data: MiddlewareData) => Promise<void> | void;
