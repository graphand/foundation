import { Module, symbolModuleInit } from "@graphand/client";
import { AuthMethodOptions, AuthMethods, AuthProviders } from "@graphand/core";
import { LoginData } from "./types";

class ModuleAuth extends Module<{}> {
  static moduleName = "auth" as const;

  async [symbolModuleInit]() {
    console.log("ModuleAuth init");
  }

  async login<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(
    providerOrData: LoginData<P, M> | P,
    methodOrData?: Omit<LoginData<P, M>, "provider"> | M,
    data?: Omit<LoginData<P, M>, "provider" | "method">,
    query?: Record<string, string>,
  ) {
    let body: LoginData<P, M>;

    if (data && typeof data === "object") {
      body = data;
    } else {
      body = {};
    }

    if (typeof providerOrData === "string") {
      body.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(body, providerOrData);
    }

    if (typeof methodOrData === "string") {
      body.method = methodOrData;
    } else if (methodOrData) {
      Object.assign(body, methodOrData);
    }

    body.method ??= AuthMethods.WINDOW as M;

    if (body.method === AuthMethods.REDIRECT) {
      body.options ??= {} as any;
      const options = body.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= window.location.href;
    }

    // const res = await this.executeController(controllersMap.login, {
    //   query,
    //   body,
    // });

    // const { accessToken, refreshToken } = await handleAuthResponse(res, body.method, this);

    // this.setOptions({
    //   accessToken,
    //   refreshToken,
    // });
  }
}

export default ModuleAuth;
