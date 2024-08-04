import { faker } from "@faker-js/faker";
import { Client, ClientModules, ClientOptions, ModuleConstructor } from "@graphand/client";
import ModuleAuth from "./ModuleAuth";
import {
  Account,
  AuthMethods,
  AuthProviders,
  controllerConfigureAuth,
  controllerCurrentAccount,
  controllerGenTokenToken,
  ModelJSON,
  Role,
  Token,
} from "@graphand/core";
import { AuthStorage } from "./types";

export const createClient = <T extends ModuleConstructor[] = ModuleConstructor[]>(
  modules: ClientModules<T> = [] as ClientModules<T>,
  options: Partial<ClientOptions> = {},
): Client<T> => {
  options ??= {};
  options.endpoint ??= process.env.ENDPOINT;
  options.ssl ??= process.env.SSL !== "0";
  options.accessToken ??= process.env.ACCESS_TOKEN;
  options.project ??= process.env.PROJECT;
  options.headers ??= {};
  options.headers["X-Access-Key"] ??= process.env.ACCESS_KEY;
  return new Client(modules, options as ClientOptions);
};

describe("ModuleAuth", () => {
  let client: Client<[typeof ModuleAuth]>;

  beforeEach(() => {
    client = createClient([[ModuleAuth]]);
  });

  afterEach(() => {
    client.destroy();
  });

  it("should initialize with default memory storage", () => {
    expect(client.get("auth").storage).toBeDefined();
  });

  it("should use custom storage when provided", () => {
    const customStorage: AuthStorage = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const customClient = createClient([[ModuleAuth, { storage: customStorage }]]);
    expect(customClient.get("auth").storage).toBe(customStorage);
  });

  it("should be able to register and login", async () => {
    client.setOptions({ accessToken: "test-access-token" });

    const email = faker.internet.email();
    const password = faker.internet.password();

    const spySetTokens = jest.spyOn(client.get("auth"), "setTokens");

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

    const spySetItem = jest.spyOn(AsyncStorage, "setItem");

    const _client = createClient(
      [
        [
          ModuleAuth,
          {
            storage: AsyncStorage,
          },
        ],
      ],
      { accessToken: "test-access-token" },
    );

    const email = faker.internet.email();
    const password = faker.internet.password();

    const spySetTokens = jest.spyOn(_client.get("auth"), "setTokens");

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
      endpoint: process.env.ENDPOINT,
      ssl: process.env.SSL !== "0",
      project: null,
      headers: {
        "X-Access-Key": process.env.ACCESS_KEY,
      },
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

    let redirectHandler: Promise<void>;

    const _client2 = new Client(
      [
        [
          ModuleAuth,
          {
            handleRedirect: async _url => {
              redirectHandler = (async () => {
                const url = new URL(_url);
                const redirectURL = new URL(url.searchParams.get("redirect"));
                redirectURL.searchParams.set("state", url.searchParams.get("state"));
                redirectURL.searchParams.set("graphandToken", graphandToken);
                const res = await fetch(redirectURL.toString());
                const code = await res.text();
                await _client2.get("auth").handleCode(code);
              })();
            },
          },
        ],
      ],
      {
        endpoint: process.env.ENDPOINT,
        ssl: process.env.SSL !== "0",
        project: process.env.PROJECT,
        headers: {
          "X-Access-Key": process.env.ACCESS_KEY,
        },
      },
    );

    await _client2.get("auth").login({ provider: AuthProviders.GRAPHAND, method: AuthMethods.CODE });

    expect(_client2.options.accessToken).toBeUndefined();

    await redirectHandler;

    expect(_client2.options.accessToken).not.toBeUndefined();

    _client.destroy();
    _client2.destroy();
  });

  it("should handle auth result from URL", async () => {
    const mockSuccess = jest.fn();
    const mockError = jest.fn();
    const _client = createClient([
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

    const _client2 = createClient([
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

  it("should refresh token if expired", async () => {
    const role = await client.getModel(Role).get();
    const token = await client
      .getModel(Token)
      .create({ name: faker.random.alphaNumeric(10), role: role._id, lifetime: 0.3 });
    const res = await client.execute(controllerGenTokenToken, {
      params: { id: token._id },
    });

    const accessToken = await res.json().then(r => r.data);

    client.setOptions({ accessToken: null });

    expect(client.options.accessToken).toBeNull();

    const email = faker.internet.email();
    const password = faker.internet.password();

    await client.get("auth").register({ configuration: { email, password } });

    client.setOptions({ accessToken });

    expect(client.options.accessToken).toBe(accessToken);

    await new Promise(resolve => setTimeout(resolve, 300));

    const spyRefreshToken = jest.spyOn(client.get("auth"), "refreshToken");

    const resAccount = await client.execute(controllerCurrentAccount);

    expect(spyRefreshToken).toHaveBeenCalled();

    expect(resAccount.ok).toBeTruthy();
  });
});
