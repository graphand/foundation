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
  InferControllerInput,
} from "@graphand/core";
import { AuthCallbackHandler, AuthStorage } from "./types.js";

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
  autoRefreshToken?: boolean;
  storage?: AuthStorage;
  storagePrefix?: string;
  getRedirectUrl?: () => string | URL | Promise<string | URL>;
  handleCallback?: AuthCallbackHandler; // { window: ..., redirect: ..., code: ... }
  handleAccessToken?: (_accessToken: string | undefined) => void;
  handleRedirectUrl?: {
    url: string | URL | Promise<string | URL>;
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
  defaults = { storage: new MemoryStorage(), autoRefreshToken: true };

  get storage() {
    return this.conf.storage;
  }

  async [symbolModuleInit]() {
    const client = this.client();

    if (this.conf.autoRefreshToken) {
      client.hook(
        "afterRequest",
        async ({ err, transaction }) => {
          if (err?.filter(Boolean).some(e => (e as FetchError).code === ErrorCodes.TOKEN_EXPIRED)) {
            await this.refreshToken();
            throw transaction.retryToken;
          }
        },
        { handleErrors: true },
      );
    }

    if (this.conf.handleRedirectUrl) {
      const { url, onSuccess, onError } = this.conf.handleRedirectUrl;
      try {
        const newUrl = await this.handleRedirectUrl(await url);
        onSuccess?.(newUrl);
        return;
      } catch (e) {
        onError?.(e as Error);
      }
    }

    const accessToken = await this.storage?.getItem(this.getStorageKey("accessToken"));
    if (accessToken) {
      this.#setClientToken(accessToken);
    }
  }

  async [symbolModuleDestroy]() {}

  #setClientToken(accessToken: string | undefined) {
    this.client().setOptions({ accessToken });

    if (typeof this.conf.handleAccessToken === "function") {
      this.conf.handleAccessToken(accessToken);
    }
  }

  getStoragePrefix() {
    if (this.conf.storagePrefix) {
      return this.conf.storagePrefix;
    }

    const client = this.client();
    return client.options.project ? `graphand-auth:${client.options.project}` : "graphand-auth";
  }

  getStorageKey(key: string) {
    const prefix = this.getStoragePrefix();
    return `${prefix}:${key}`;
  }

  async setTokens(accessToken: string, refreshToken: string) {
    this.#setClientToken(accessToken);

    if (this.storage) {
      await this.storage.setItem(this.getStorageKey("accessToken"), accessToken);
      await this.storage.setItem(this.getStorageKey("refreshToken"), refreshToken);
    }
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

    if (data.method === AuthMethods.REDIRECT && !data.options?.redirect) {
      if (typeof this.conf.getRedirectUrl !== "function") {
        let message = "getRedirectUrl option must be a valid function to use redirect method";
        if (typeof window !== "undefined") message += ". You can use window.location.href in browser";
        throw new Error(message);
      }

      data.options ??= {} as any;
      const options = data.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= new URL(await this.conf.getRedirectUrl()).toString();
    }

    const res = await this.client().execute(controllerLogin, { data });

    const json = await res.json();

    return this.handleAuthResult(json.data, data.method, data.options);
  }

  async register<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(
    providerOrData: RegisterData<P, M> | P,
    methodOrData?: Omit<RegisterData<P, M>, "provider"> | M,
    _data?: Omit<RegisterData<P, M>, "provider" | "method">,
    query?: NonNullable<InferControllerInput<typeof controllerRegister>>["query"],
  ) {
    let data: RegisterData<P, M>;

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

    if (data.method === AuthMethods.REDIRECT && !data.options?.redirect) {
      if (typeof this.conf.getRedirectUrl !== "function") {
        let message = "getRedirectUrl option must be a valid function to use redirect method";
        if (typeof window !== "undefined") message += ". You can use window.location.href in browser";
        throw new Error(message);
      }

      data.options ??= {} as any;
      const options = data.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= new URL(await this.conf.getRedirectUrl()).toString();
    }

    const res = await this.client().execute(controllerRegister, { data, query });

    const json = await res.json();

    return this.handleAuthResult(json.data, data.method, data.options);
  }

  async refreshToken() {
    if (!this.storage) {
      throw new Error("No storage available");
    }

    const refreshToken = await this.storage.getItem(this.getStorageKey("refreshToken"));
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const accessToken = await this.storage.getItem(this.getStorageKey("accessToken"));
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

  async handleAuthResult<M extends AuthMethods>(result: AuthResult, method: M, options?: AuthMethodOptions<M>) {
    if ("url" in result) {
      if (!this.conf.handleCallback) {
        throw new Error(`handleCallback option must be defined to handle the callback url for method ${method}`);
      }

      if (!this.conf.handleCallback[method]) {
        throw new Error(
          `handleCallback.${method} option must be defined to handle the callback url for method ${method}`,
        );
      }

      const url = new URL(result.url.startsWith("/") ? "http://" + result.url : result.url);
      await this.conf.handleCallback[method](url, options);
      return;
    }

    const { accessToken, refreshToken, account } = result;

    const instance = this.client().getModel(Account).hydrateAndCache(account);

    await this.setTokens(accessToken, refreshToken);

    return instance;
  }

  async handleRedirectUrl(url: string | URL): Promise<URL> {
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

    return this.handleAuthResult(json.data, AuthMethods.CODE);
  }

  async logout() {
    this.#setClientToken(undefined);

    if (this.storage) {
      await this.storage.removeItem(this.getStorageKey("accessToken"));
      await this.storage.removeItem(this.getStorageKey("refreshToken"));
    }
  }
}

export default ModuleAuth;
