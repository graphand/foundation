import type { Account, AuthMethodOptions, AuthMethods, ModelInstance, ModelJSON } from "@graphand/core";

export type AuthStorage = {
  setItem(_key: string, _value: string): Promise<void> | void;
  getItem(_key: string): Promise<string | null> | string | null;
  removeItem(_key: string): Promise<void> | void;
};

export type AuthCallbackHandler = {
  [M in AuthMethods]?: (_url: URL, _options?: AuthMethodOptions<M>) => void | Promise<void>;
};

export type ModuleAuthOptions = {
  autoRefreshToken?: boolean;
  storage?: AuthStorage;
  storagePrefix?: string;
  getRedirectUrl?: () => string | URL | Promise<string | URL>;
  handleCallback?: AuthCallbackHandler; // { window: ..., redirect: ..., code: ... }
  handleAccessToken?: (_accessToken: string | undefined) => void;
  autoSetTokens?: boolean;
  handleRedirectUrl?: {
    url: string | URL | Promise<string | URL>;
    onSuccess?: (_url: URL) => void;
    onError?: (_error: Error) => void;
  };
};

export type AuthResult =
  | {
      action: "login" | "register";
      account: ModelJSON<typeof Account>;
      accessToken: string;
      refreshToken: string;
    }
  | {
      url: string;
    };

export type ParsedAuthResult<A extends typeof Account> = {
  account: ModelInstance<A>;
  accessToken: string;
  refreshToken: string;
};
