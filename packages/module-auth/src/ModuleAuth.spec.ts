import { MockInstance, vi } from "vitest";
import { ObjectId } from "bson";
import { faker } from "@faker-js/faker";
import { Client } from "@graphand/client";
import { Account, AuthMethods, AuthProviders, controllerConfigureAuth, ModelJSON } from "@graphand/core";
import ModuleAuth from "./ModuleAuth.ts";
import { AuthStorage } from "./types.ts";

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
        // const method = body.method ?? AuthMethods.WINDOW;

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
        // const method = body.method ?? AuthMethods.WINDOW;

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
  });

  it("should be able to register and login", async () => {
    client.setOptions({ accessToken: "test-access-token" });

    const email = faker.internet.email();
    const password = faker.internet.password();

    const spySetTokens = vi.spyOn(client.get("auth"), "setTokens");

    expect(spySetTokens).toHaveBeenCalledTimes(0);

    expect(client.options.accessToken).toEqual("test-access-token");

    const resRegister = await client.get("auth").register({ configuration: { email, password } });

    expect(resRegister).toHaveProperty("_id");

    expect(spySetTokens).toHaveBeenCalledTimes(1);
    expect(client.options.accessToken).not.toEqual("test-access-token");

    client.setOptions({ accessToken: "test-access-token" });

    const resLogin = await client.get("auth").login({ credentials: { email, password } });

    expect(resLogin).toHaveProperty("_id");

    expect(spySetTokens).toHaveBeenCalledTimes(2);
    expect(client.options.accessToken).not.toEqual("test-access-token");

    client.setOptions({ accessToken: "test-access-token" });

    await client.get("auth").refreshToken();

    expect(spySetTokens).toHaveBeenCalledTimes(3);
    expect(client.options.accessToken).not.toEqual("test-access-token");

    await client.get("auth").logout();

    expect(client.options.accessToken).toBeUndefined();
  });

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

    _client.setOptions({ accessToken: "test-access-token" });

    const resLogin = await _client.get("auth").login({ credentials: { email, password } });

    expect(resLogin).toHaveProperty("_id");

    expect(spySetTokens).toHaveBeenCalledTimes(2);
    expect(_client.options.accessToken).not.toEqual("test-access-token");

    _client.setOptions({ accessToken: "test-access-token" });

    await _client.get("auth").refreshToken();

    expect(spySetTokens).toHaveBeenCalledTimes(3);
    expect(_client.options.accessToken).not.toEqual("test-access-token");
  });

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

    let redirectHandler: Promise<void> | undefined;

    const _client2 = new Client([
      [
        ModuleAuth,
        {
          handleRedirect: async _url => {
            redirectHandler = (async () => {
              const url = new URL(_url);
              const redirectURL = new URL(url.searchParams?.get("redirect") || "");
              redirectURL.searchParams.set("state", url.searchParams?.get("state") || "");
              redirectURL.searchParams.set("graphandToken", graphandToken || "");
              // const res = await fetch(redirectURL.toString());
              // const code = await res.text();
              const code = faker.internet.password();
              await _client2.get("auth").handleCode(code);
            })();
          },
        },
      ],
    ]);

    await _client2.get("auth").login({ provider: AuthProviders.GRAPHAND, method: AuthMethods.CODE });

    expect(_client2.options.accessToken).toBeUndefined();

    await redirectHandler;

    expect(_client2.options.accessToken).not.toBeUndefined();

    _client.destroy();
    _client2.destroy();
  });

  it("should handle auth result from URL", async () => {
    const mockSuccess = vi.fn();
    const mockError = vi.fn();
    const _client = new Client([
      [
        ModuleAuth,
        {
          handleResult: { url: "http://localhost:3000/auth/handle", onSuccess: mockSuccess, onError: mockError },
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
          handleResult: {
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
});
