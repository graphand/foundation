import { AuthMethodOptions, AuthMethods } from "@graphand/core";

export type AuthStorage = {
  setItem(_key: string, _value: string): Promise<void> | void;
  getItem(_key: string): Promise<string | null> | string | null;
  removeItem(_key: string): Promise<void> | void;
};

export type AuthCallbackHandler = {
  [M in AuthMethods]?: (_url: URL, _options?: AuthMethodOptions<M>) => void | Promise<void>;
};
