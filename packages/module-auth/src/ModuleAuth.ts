import { FetchError, Module, symbolModuleDestroy, symbolModuleInit } from "@graphand/client";
import {
  Account,
  AuthMethodOptions,
  AuthMethods,
  AuthProviders,
  controllerLogin,
  controllerRegister,
  ErrorCodes,
  ModelJSON,
  LoginData,
  RegisterData,
  controllerRefreshToken,
  controllerCodeAuth,
} from "@graphand/core";
import { AuthStorage } from "./types";

class MemoryStorage implements AuthStorage {
  private store: Record<string, string> = {};

  setItem(key: string, value: string) {
    this.store[key] = value;
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

type ModuleAuthOptions = {
  storage?: AuthStorage;
  handleRedirect?: (_url: string) => void;
  handleResult?: {
    url: string | URL;
    onSuccess?: (_url: URL) => void;
    onError?: (_error: Error) => void;
  };
};

type AuthResult =
  | {
      action: "login" | "register";
      account: ModelJSON<typeof Account>;
      accessToken: string;
      refreshToken: string;
    }
  | {
      url: string;
    };

class ModuleAuth extends Module<ModuleAuthOptions> {
  static moduleName = "auth" as const;
  defaults = { storage: new MemoryStorage() };

  get storage() {
    return this.conf.storage;
  }

  async [symbolModuleInit]() {
    const client = this.client();

    client.hook(
      "afterRequest",
      async ({ err, transaction }) => {
        if (err?.some(e => (e as FetchError).code === ErrorCodes.TOKEN_EXPIRED)) {
          await this.refreshToken();
          throw transaction.retryToken;
        }
      },
      { handleErrors: true },
    );

    if (this.conf.handleResult) {
      const { url, onSuccess, onError } = this.conf.handleResult;
      try {
        const newUrl = await this.handleResult(url);
        onSuccess?.(newUrl);
        return;
      } catch (e) {
        onError?.(e as Error);
      }
    }

    const accessToken = await this.storage.getItem("accessToken");
    if (accessToken) {
      client.setOptions({ accessToken });
    }
  }

  async [symbolModuleDestroy]() {}

  async setTokens(accessToken: string, refreshToken: string) {
    await this.storage.setItem("accessToken", accessToken);
    await this.storage.setItem("refreshToken", refreshToken);
    this.client().setOptions({ accessToken });
  }

  async login<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(
    providerOrData: LoginData<P, M> | P,
    methodOrData?: Omit<LoginData<P, M>, "provider"> | M,
    _data?: Omit<LoginData<P, M>, "provider" | "method">,
    _query?: Record<string, string>,
  ) {
    let data: LoginData<P, M>;

    if (_data && typeof _data === "object") {
      data = _data;
    } else {
      data = {};
    }

    if (typeof providerOrData === "string") {
      data.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(data, providerOrData);
    }

    if (typeof methodOrData === "string") {
      data.method = methodOrData;
    } else if (methodOrData) {
      Object.assign(data, methodOrData);
    }

    data.method ??= AuthMethods.WINDOW as M;

    if (data.method === AuthMethods.REDIRECT) {
      data.options ??= {} as any;
      const options = data.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= window.location.href;
    }

    const res = await this.client().execute(controllerLogin, {
      data,
    });

    const json = await res.json();

    return this.handleAuthResult(json.data);
  }

  async register<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(
    providerOrData: RegisterData<P, M> | P,
    methodOrData?: Omit<RegisterData<P, M>, "provider"> | M,
    _data?: Omit<RegisterData<P, M>, "provider" | "method">,
  ) {
    let data: RegisterData<P, M>;

    if (data && typeof data === "object") {
      data = _data;
    } else {
      data = {};
    }

    if (typeof providerOrData === "string") {
      data.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(data, providerOrData);
    }

    if (typeof methodOrData === "string") {
      data.method = methodOrData;
    } else if (methodOrData) {
      Object.assign(data, methodOrData);
    }

    data.method ??= AuthMethods.WINDOW as M;

    if (data.method === AuthMethods.REDIRECT) {
      data.options ??= {} as any;
      const options = data.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= window.location.href;
    }

    const res = await this.client().execute(controllerRegister, {
      data,
    });

    const json = await res.json();

    return this.handleAuthResult(json.data);
  }

  async refreshToken() {
    const refreshToken = await this.storage.getItem("refreshToken");
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const accessToken = await this.storage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const res = await this.client().execute(controllerRefreshToken, {
      data: { accessToken, refreshToken },
    });

    const json = await res.json();

    await this.setTokens(json.data.accessToken, json.data.refreshToken);

    return json.data;
  }

  async handleAuthResult(result: AuthResult) {
    if ("url" in result) {
      if (typeof this.conf.handleRedirect !== "function") {
        throw new Error("handleRedirect option must be a valid function");
      }
      this.conf.handleRedirect(result.url);
      return;
    }

    const { accessToken, refreshToken, account } = result;

    const instance = this.client().getModel(Account).hydrateAndCache(account);

    await this.setTokens(accessToken, refreshToken);

    return instance;
  }

  async handleResult(url: string | URL): Promise<URL> {
    url = typeof url === "string" ? new URL(url) : url;
    const authResult = url.searchParams.get("authResult");

    if (!authResult) {
      throw new Error("authResult search param not found in url");
    }

    const { accessToken, refreshToken } = JSON.parse(authResult);

    await this.setTokens(accessToken, refreshToken);

    url.searchParams.delete("authResult");

    return url;
  }

  async handleCode(code: string) {
    const res = await this.client().execute(controllerCodeAuth, { query: { code } });

    const json = await res.json();

    return this.handleAuthResult(json.data);
  }

  async logout() {
    await this.storage.removeItem("accessToken");
    await this.storage.removeItem("refreshToken");
    this.client().setOptions({ accessToken: undefined });
  }
}

export default ModuleAuth;
