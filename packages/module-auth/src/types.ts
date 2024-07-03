import { AuthMethodOptions, AuthMethods, AuthProviderCredentials, AuthProviders } from "@graphand/core";

export type LoginData<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW> = {
  provider?: P;
  method?: M;
  credentials?: AuthProviderCredentials<P>;
  options?: AuthMethodOptions<M>;
};
