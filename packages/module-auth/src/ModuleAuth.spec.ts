import { MockInstance, vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { ObjectId } from "bson";
import { faker } from "@faker-js/faker";
import { Client } from "@graphand/client";
import {
  Account,
  AuthMethods,
  AuthProviders,
  controllerConfigureAuth,
  ModelJSON,
  ErrorCodes,
  controllerModelRead,
} from "@graphand/core";
import ModuleAuth from "./ModuleAuth.js";
import { AuthStorage } from "./types.js";

describe("ModuleAuth", () => {
  let client: Client<[typeof ModuleAuth]>;
  let spyFetch: MockInstance;

  beforeAll(() => {
    spyFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async req => {
      if (!(req instanceof Request)) {
        return new Response();
      }

      const url = new URL(req.url);

      if (url.pathname === "/auth/register") {
        const body = await req.json();
        const provider = body.provider ?? AuthProviders.LOCAL;

        if (provider === AuthProviders.LOCAL) {
          const _email = body.configuration?.email ?? faker.internet.email();
          const account = await client.getModel(Account).hydrate({ _id: new ObjectId().toString(), _email });
          const accessToken = faker.internet.password();
          const refreshToken = faker.internet.password();
          return new Response(
            JSON.stringify({
              data: {
                account,
                accessToken,
                refreshToken,
              },
            }),
          );
        }
      }

      if (url.pathname === "/auth/login") {
        const body = await req.json();
        const provider = body.provider ?? AuthProviders.LOCAL;

        if (provider === AuthProviders.LOCAL) {
          const _email = body.credentials?.email ?? faker.internet.email();
          const account = await client.getModel(Account).hydrate({ _id: new ObjectId().toString(), _email });
          const accessToken = faker.internet.password();
          const refreshToken = faker.internet.password();
          return new Response(
            JSON.stringify({
              data: {
                account,
                accessToken,
                refreshToken,
              },
            }),
          );
        }

        if (provider === AuthProviders.GRAPHAND) {
          const redirectUrl = new URL(url.toString());
          redirectUrl.pathname = "/auth/handle";
          const _url = faker.internet.url() + "?redirect=" + redirectUrl.toString();
          return new Response(JSON.stringify({ data: { url: _url } }));
        }
      }

      if (url.pathname === "/auth/refresh") {
        return new Response(
          JSON.stringify({ data: { accessToken: faker.internet.password(), refreshToken: faker.internet.password() } }),
        );
      }

      if (url.pathname === "/auth/configure") {
        const body = await req.json();
        const provider = body.provider ?? AuthProviders.LOCAL;

        if (provider === AuthProviders.GRAPHAND) {
          if (body.configuration?.graphandToken) {
            return new Response(JSON.stringify({ data: {} }));
          }
        }
      }

      if (url.pathname === "/auth/code") {
        const account = await client
          .getModel(Account)
          .hydrate({ _id: new ObjectId().toString(), _email: faker.internet.email() });
        const accessToken = faker.internet.password();
        const refreshToken = faker.internet.password();
        return new Response(
          JSON.stringify({
            data: {
              account,
              accessToken,
              refreshToken,
            },
          }),
        );
      }

      return new Response(JSON.stringify({ data: {} }));
    });
  });

  afterAll(() => {
    spyFetch.mockRestore();
  });

  beforeEach(() => {
    client = new Client([[ModuleAuth]]);
  });

  afterEach(() => {
    client.destroy();
  });

  describe("Initialization", () => {
    it("should initialize with default memory storage", () => {
      expect(client.get("auth").storage).toBeDefined();
    });

    it("should use custom storage when provided", () => {
      const customStorage: AuthStorage = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const customClient = new Client([[ModuleAuth, { storage: customStorage }]]);
      expect(customClient.get("auth").storage).toBe(customStorage);
      customClient.destroy();
    });
  });

  describe("Authentication Flow", () => {
    it("should be able to register, login, refresh token, and logout", async () => {
      client.setOptions({ accessToken: "test-access-token" });

      const email = faker.internet.email();
      const password = faker.internet.password();

      const spySetTokens = vi.spyOn(client.get("auth"), "setTokens");

      expect(spySetTokens).toHaveBeenCalledTimes(0);
      expect(client.options.accessToken).toEqual("test-access-token");

      // Register
      const resRegister = await client.get("auth").register({ configuration: { email, password } });
      expect(resRegister).toHaveProperty("_id");
      expect(spySetTokens).toHaveBeenCalledTimes(1);
      expect(client.options.accessToken).not.toEqual("test-access-token");

      // Login
      client.setOptions({ accessToken: "test-access-token" });
      const resLogin = await client.get("auth").login({ credentials: { email, password } });
      expect(resLogin).toHaveProperty("_id");
      expect(spySetTokens).toHaveBeenCalledTimes(2);
      expect(client.options.accessToken).not.toEqual("test-access-token");

      // Refresh Token
      client.setOptions({ accessToken: "test-access-token" });
      await client.get("auth").refreshToken();
      expect(spySetTokens).toHaveBeenCalledTimes(3);
      expect(client.options.accessToken).not.toEqual("test-access-token");

      // Logout
      await client.get("auth").logout();
      expect(client.options.accessToken).toBeUndefined();
    });
  });

  describe("Async Storage", () => {
    it("should work with async storage", async () => {
      const store: Record<string, string> = {};
      const AsyncStorage: AuthStorage = {
        setItem: async (key: string, value: string) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          store[key] = value;
        },
        getItem: async (key: string) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return store[key] || null;
        },
        removeItem: async (key: string) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          delete store[key];
        },
      };

      const spySetItem = vi.spyOn(AsyncStorage, "setItem");

      const _client = new Client(
        [
          [
            ModuleAuth,
            {
              storage: AsyncStorage,
            },
          ],
        ],
        { accessToken: "test-access-token", project: null },
      );

      const email = faker.internet.email();
      const password = faker.internet.password();

      const spySetTokens = vi.spyOn(_client.get("auth"), "setTokens");

      expect(spySetTokens).toHaveBeenCalledTimes(0);
      expect(_client.options.accessToken).toEqual("test-access-token");

      const resRegister = await _client.get("auth").register({ configuration: { email, password } });

      expect(resRegister).toHaveProperty("_id");
      expect(spySetTokens).toHaveBeenCalledTimes(1);
      expect(_client.options.accessToken).not.toEqual("test-access-token");
      expect(spySetItem).toHaveBeenCalled();

      _client.destroy();
    });
  });

  describe("GRAPHAND Provider", () => {
    it("should be able to login with GRAPHAND provider and CODE method", async () => {
      const _client = new Client([[ModuleAuth]], {
        project: null,
      });

      const email = faker.internet.email();
      const password = faker.internet.password();
      const firstname = faker.name.firstName();
      const lastname = faker.name.lastName();

      const account = { firstname, lastname } as ModelJSON<typeof Account>;

      await _client.get("auth").register({ configuration: { email, password }, account });

      const graphandToken = _client.options.accessToken;

      await client.get("auth").register({ configuration: { email, password } });

      await client.execute(controllerConfigureAuth, {
        data: { provider: AuthProviders.GRAPHAND, configuration: { graphandToken } },
      });

      const _client2 = new Client([
        [
          ModuleAuth,
          {
            handleCallback: {
              [AuthMethods.CODE]: async url => {
                const res = await fetch(url.toString());
                const code = await res.text();
                await _client2.get("auth").handleCode(code);
              },
            },
          },
        ],
      ]);

      expect(_client2.options.accessToken).toBeUndefined();

      await _client2.get("auth").login({ provider: AuthProviders.GRAPHAND, method: AuthMethods.CODE });

      expect(_client2.options.accessToken).not.toBeUndefined();

      _client.destroy();
      _client2.destroy();
    });

    it("should not be able to use REDIRECT method without getRedirectUrl option", async () => {
      const _client = new Client([[ModuleAuth]], {
        project: null,
      });

      const email = faker.internet.email();
      const password = faker.internet.password();
      const firstname = faker.name.firstName();
      const lastname = faker.name.lastName();

      const account = { firstname, lastname } as ModelJSON<typeof Account>;

      await _client.get("auth").register({ configuration: { email, password }, account });

      const graphandToken = _client.options.accessToken;

      await client.get("auth").register({ configuration: { email, password } });

      await client.execute(controllerConfigureAuth, {
        data: { provider: AuthProviders.GRAPHAND, configuration: { graphandToken } },
      });

      const _client2 = new Client([[ModuleAuth, {}]]);

      expect(_client2.options.accessToken).toBeUndefined();

      await expect(
        _client2.get("auth").login({ provider: AuthProviders.GRAPHAND, method: AuthMethods.REDIRECT }),
      ).rejects.toThrow("getRedirectUrl option must be a valid function to use redirect method");

      _client.destroy();
      _client2.destroy();
    });

    it("should be able to login with GRAPHAND provider and REDIRECT method", async () => {
      const _client = new Client([[ModuleAuth]], {
        project: null,
      });

      const email = faker.internet.email();
      const password = faker.internet.password();
      const firstname = faker.name.firstName();
      const lastname = faker.name.lastName();

      const account = { firstname, lastname } as ModelJSON<typeof Account>;

      await _client.get("auth").register({ configuration: { email, password }, account });

      const graphandToken = _client.options.accessToken;

      await client.get("auth").register({ configuration: { email, password } });

      await client.execute(controllerConfigureAuth, {
        data: { provider: AuthProviders.GRAPHAND, configuration: { graphandToken } },
      });

      let redirectUrl: string | undefined;

      const callbackRedirect = vi.fn(async url => {
        const authResult = JSON.stringify({ accessToken: "test-access-token", refreshToken: "test-refresh-token" });
        url.searchParams.set("authResult", authResult);
        redirectUrl = url.toString();
      });

      const _client2 = new Client([
        [
          ModuleAuth,
          {
            getRedirectUrl: () => faker.internet.url(),
            handleCallback: {
              [AuthMethods.REDIRECT]: callbackRedirect,
            },
          },
        ],
      ]);

      expect(_client2.options.accessToken).toBeUndefined();

      await _client2.get("auth").login({ provider: AuthProviders.GRAPHAND, method: AuthMethods.REDIRECT });

      expect(_client2.options.accessToken).toBeUndefined();

      expect(callbackRedirect).toHaveBeenCalled();
      expect(redirectUrl).toBeDefined();

      await _client2.get("auth").handleRedirectUrl(redirectUrl as string);

      expect(_client2.options.accessToken).not.toBeUndefined();

      _client.destroy();
      _client2.destroy();
    });
  });

  describe("handleRedirectUrl", () => {
    it("should handle auth result from URL", async () => {
      const mockSuccess = vi.fn();
      const mockError = vi.fn();
      const _client = new Client([
        [
          ModuleAuth,
          {
            handleRedirectUrl: { url: "http://localhost:3000/auth/handle", onSuccess: mockSuccess, onError: mockError },
          },
        ],
      ]);

      await _client.init();

      expect(mockSuccess).not.toHaveBeenCalled();

      _client.destroy();

      const authResult = JSON.stringify({ accessToken: "test-access-token", refreshToken: "test-refresh-token" });

      const _client2 = new Client([
        [
          ModuleAuth,
          {
            handleRedirectUrl: {
              url: `http://localhost:3000/auth/handle?authResult=${authResult}`,
              onSuccess: mockSuccess,
              onError: mockError,
            },
          },
        ],
      ]);

      await _client2.init();

      expect(mockSuccess).toHaveBeenCalled();

      _client2.destroy();
    });

    it("should handle auth result from URL as a promise", async () => {
      const mockSuccess = vi.fn();
      const mockError = vi.fn();
      const _client = new Client([
        [
          ModuleAuth,
          {
            handleRedirectUrl: {
              url: Promise.resolve("http://localhost:3000/auth/handle"),
              onSuccess: mockSuccess,
              onError: mockError,
            },
          },
        ],
      ]);

      await _client.init();

      expect(mockSuccess).not.toHaveBeenCalled();

      _client.destroy();

      const authResult = JSON.stringify({ accessToken: "test-access-token", refreshToken: "test-refresh-token" });

      const _client2 = new Client([
        [
          ModuleAuth,
          {
            handleRedirectUrl: {
              url: Promise.resolve(`http://localhost:3000/auth/handle?authResult=${authResult}`),
              onSuccess: mockSuccess,
              onError: mockError,
            },
          },
        ],
      ]);

      await _client2.init();

      expect(mockSuccess).toHaveBeenCalled();

      _client2.destroy();
    });
  });

  describe("handleAccessToken", () => {
    it("should use handleAccessToken when provided", async () => {
      const handleAccessToken = vi.fn();
      const _client = new Client([[ModuleAuth, { handleAccessToken }]]);

      const email = faker.internet.email();
      const password = faker.internet.password();

      const resLogin = await _client.get("auth").login({ credentials: { email, password } });

      expect(resLogin).toHaveProperty("_id");
      expect(handleAccessToken).toHaveBeenCalledWith(_client.options.accessToken);

      _client.destroy();
    });
  });

  describe("Error Handling", () => {
    it("should throw an error when refreshing token without storage", async () => {
      const _client = new Client([[ModuleAuth, { storage: undefined }]]);
      await expect(_client.get("auth").refreshToken()).rejects.toThrow("No storage available");
      _client.destroy();
    });

    it("should throw an error when refreshing token without refresh token", async () => {
      const _client = new Client([[ModuleAuth]]);
      await expect(_client.get("auth").refreshToken()).rejects.toThrow("No refresh token available");
      _client.destroy();
    });

    it("should throw an error when handling redirect URL without authResult", async () => {
      const _client = new Client([[ModuleAuth]]);
      await expect(_client.get("auth").handleRedirectUrl("http://example.com")).rejects.toThrow(
        "authResult search param not found in url",
      );
      _client.destroy();
    });
  });

  // New tests
  describe("Storage Prefix and Key", () => {
    it("should generate correct storage prefix", () => {
      const _client = new Client([[ModuleAuth]], { project: "test-project" });
      expect(_client.get("auth").getStoragePrefix()).toBe("graphand-auth:test-project");
      _client.destroy();
    });

    it("should use custom storage prefix when provided", () => {
      const _client = new Client([[ModuleAuth, { storagePrefix: "custom-prefix" }]]);
      expect(_client.get("auth").getStoragePrefix()).toBe("custom-prefix");
      _client.destroy();
    });

    it("should generate correct storage key", () => {
      const _client = new Client([[ModuleAuth]], { project: "test-project" });
      expect(_client.get("auth").getStorageKey("accessToken")).toBe("graphand-auth:test-project:accessToken");
      _client.destroy();
    });
  });

  describe("handleAuthResult", () => {
    it("should handle login result correctly", async () => {
      const _client = new Client([[ModuleAuth]]);
      const authResult = {
        action: "login",
        account: { _id: new ObjectId().toString(), _email: faker.internet.email() },
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      };

      const result = await _client.get("auth").handleAuthResult(authResult as any, AuthMethods.WINDOW);
      expect(result).toHaveProperty("_id");
      expect(_client.options.accessToken).toBe("test-access-token");
      _client.destroy();
    });

    it("should handle URL result correctly", async () => {
      const mockHandleCallback = vi.fn();
      const _client = new Client([
        [
          ModuleAuth,
          {
            handleCallback: {
              [AuthMethods.REDIRECT]: mockHandleCallback,
            },
          },
        ],
      ]);

      const authResult = {
        url: "http://example.com/callback",
      };

      await _client.get("auth").handleAuthResult(authResult, AuthMethods.REDIRECT);
      expect(mockHandleCallback).toHaveBeenCalledWith(expect.any(URL), undefined);
      _client.destroy();
    });

    it("should throw an error when handleCallback is not defined for the method", async () => {
      const _client = new Client([[ModuleAuth]]);
      const authResult = {
        url: "http://example.com/callback",
      };

      await expect(_client.get("auth").handleAuthResult(authResult, AuthMethods.REDIRECT)).rejects.toThrow(
        "handleCallback option must be defined to handle the callback url for method redirect",
      );
      _client.destroy();
    });
  });

  describe("autoRefreshToken", () => {
    it("should automatically refresh token on TOKEN_EXPIRED error", async () => {
      const _client = new Client([[ModuleAuth, { autoRefreshToken: true }]], {
        accessToken: "test-access-token",
        project: null,
      });
      const mockRefreshToken = vi.spyOn(_client.get("auth"), "refreshToken").mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });

      const mockExecute = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: ErrorCodes.TOKEN_EXPIRED } }), {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        }),
      );

      try {
        await _client.execute(controllerModelRead);
      } catch (error) {
        // Ignore the error
      }

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledTimes(2);

      mockRefreshToken.mockRestore();
      mockExecute.mockRestore();
      _client.destroy();
    });
  });
});
