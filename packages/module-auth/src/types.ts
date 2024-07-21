import {
  Account,
  AuthMethodOptions,
  AuthMethods,
  AuthProviderConfigurePayload,
  AuthProviderCredentials,
  AuthProviders,
  ModelJSON,
} from "@graphand/core";

export type LoginData<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW> = {
  provider?: P;
  method?: M;
  credentials?: AuthProviderCredentials<P>;
  options?: AuthMethodOptions<M>;
};

export type RegisterData<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW> = {
  provider?: P;
  method?: M;
  account?: Omit<ModelJSON<typeof Account>, "role">;
  configuration?: AuthProviderConfigurePayload<P>;
  options?: AuthMethodOptions<M>;
};

export type AuthStorage = {
  setItem(_key: string, _value: string): Promise<void> | void;
  getItem(_key: string): Promise<string | null> | string | null;
  removeItem(_key: string): Promise<void> | void;
};
