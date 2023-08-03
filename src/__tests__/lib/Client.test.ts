import { Account, IdentityTypes, Key, Model, Role } from "@graphand/core";
import { generateRandomString, getClient } from "../../lib/test-utils";
import Client from "../../lib/Client";
import { faker } from "@faker-js/faker";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";

describe("test client", () => {
  it("declareGlobally", () => {
    const client = globalThis.client;

    class CustomModel extends Model {
      static slug = "custom";
    }

    const clientAdapterClass = client.getClientAdapter();

    expect(CustomModel.getAdapter().base).toBe(clientAdapterClass);
    expect(CustomModel.getAdapter().model).toBe(CustomModel);

    expect(clientAdapterClass.__modelsMap?.has("custom")).toBeTruthy();

    const adaptedModel = client.getModel(CustomModel);

    expect(adaptedModel.getAdapter().base).toBe(client.getClientAdapter());

    expect(adaptedModel.getAdapter()).toBe(CustomModel.getAdapter());

    const client2 = getClient();
    const clientAdapterClass2 = client2.getClientAdapter();

    const adaptedModel2 = client2.getModel(CustomModel);

    expect(adaptedModel2.getAdapter().base).toBe(clientAdapterClass2);
  });

  it("initialize client with genKeyToken should get an accessToken", async () => {
    const globalClient: Client = globalThis.client;
    const role = await Role.create({
      slug: generateRandomString(),
    });
    const account = await Account.create({
      email: faker.internet.email(),
      role,
    });

    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const key = await globalClient.getModel(Key).create({
      name: generateRandomString(),
      value: keyPair.publicKey,
    });

    const identityToken = jwt.sign(
      { type: IdentityTypes.ACCOUNT, id: account._id },
      keyPair.privateKey,
      { algorithm: "RS256" }
    );

    const client = getClient({
      accessToken: undefined,
      genKeyToken: {
        keyId: key._id,
        identityToken,
      },
    });

    expect(
      (await client.getModel(Account).getList()).some(
        (a) => a._id === account._id
      )
    ).toBeTruthy();
  });

  it("initialize model", async () => {
    const client = globalThis.client;

    class CustomModel extends Model {
      static slug = "custom";
    }

    const jestWatcherFn = jest.fn();

    CustomModel.hook("before", "initialize", jestWatcherFn);

    await CustomModel.initialize();

    expect(jestWatcherFn).toBeCalledTimes(1);

    await CustomModel.initialize();

    expect(jestWatcherFn).toBeCalledTimes(1);

    const adaptedModel = client.getModel(CustomModel);

    await adaptedModel.initialize();

    expect(jestWatcherFn).toBeCalledTimes(1);

    const client2 = getClient();

    const adaptedModel2 = client2.getModel(CustomModel);

    await adaptedModel2.initialize();

    expect(jestWatcherFn).toBeCalledTimes(2);
  });

  it("should connect sockets only if needed", async () => {
    const client = getClient({
      sockets: ["project"],
    });

    const jestWatcherFn = jest.fn((scope: string) => {
      client.__socketsMap ??= new Map();
      client.__socketsMap.set(scope as any, true as any);
    });

    client.connectSocket = jestWatcherFn;

    client.setOptions({
      sockets: ["global"],
    });

    expect(jestWatcherFn).toBeCalledTimes(1);
    expect(client.__socketsMap?.has("global")).toBeTruthy();
    expect(client.__socketsMap?.has("project")).toBeFalsy();

    client.setOptions({
      sockets: ["global"],
    });

    expect(jestWatcherFn).toBeCalledTimes(1);

    client.setOptions({
      sockets: ["global", "project"],
    });

    expect(jestWatcherFn).toBeCalledTimes(2);
    expect(client.__socketsMap?.has("global")).toBeTruthy();
    expect(client.__socketsMap?.has("project")).toBeTruthy();
  });

  it("should reconnect all sockets if needed", async () => {
    const client = getClient({
      sockets: ["global", "project"],
    });

    const jestWatcherFn = jest.fn((scope: string) => {
      client.__socketsMap ??= new Map();
      client.__socketsMap.set(scope as any, true as any);
    });

    client.connectSocket = jestWatcherFn;

    expect(jestWatcherFn).toBeCalledTimes(0);

    client.setOptions({
      endpoint: "...",
    });

    expect(jestWatcherFn).toBeCalledTimes(2);
  });

  it("refreshToken should refresh access and refresh tokens", async () => {
    const globalClient: Client = globalThis.client;
    const role = await Role.create({
      slug: generateRandomString(),
    });
    const account = await Account.create({
      email: faker.internet.email(),
      role,
    });

    const _accessToken = await globalClient.genAccountToken(account._id);

    const client = getClient({
      accessToken: _accessToken,
      refreshToken: undefined,
    });

    expect(client.options.refreshToken).toBeUndefined();

    await client.configureAuth({
      configuration: {
        password: "test",
      },
    });
    await client.loginAccount({
      credentials: {
        email: account.email,
        password: "test",
      },
    });

    expect(client.options.refreshToken).toBeDefined();

    const { accessToken, refreshToken } = client.options;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await client.refreshToken();

    expect(client.options.accessToken).not.toBe(accessToken);
    expect(client.options.refreshToken).not.toBe(refreshToken);

    const { exp: expBefore } = jwt.decode(accessToken);
    const { exp: expAfter } = jwt.decode(client.options.accessToken);

    expect(expAfter).toBeGreaterThan(expBefore);

    expect(
      (await client.getModel(Account).getList()).some(
        (a) => a._id === account._id
      )
    ).toBeTruthy();
  });

  it("refreshTokenWithKey should refresh access token", async () => {
    const globalClient: Client = globalThis.client;
    const role = await Role.create({
      slug: generateRandomString(),
    });
    const account = await Account.create({
      email: faker.internet.email(),
      role,
    });

    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const key = await globalClient.getModel(Key).create({
      name: generateRandomString(),
      value: keyPair.publicKey,
    });

    const identityToken = jwt.sign(
      { type: IdentityTypes.ACCOUNT, id: account._id },
      keyPair.privateKey,
      { algorithm: "RS256" }
    );

    const client = getClient({
      accessToken: undefined,
      genKeyToken: {
        keyId: key._id,
        identityToken,
      },
    });

    await client.configureAuth({
      configuration: {
        password: "test",
      },
    });
    await client.loginAccount({
      credentials: {
        email: account.email,
        password: "test",
      },
    });

    const { accessToken } = client.options;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await client.refreshTokenWithKey();

    expect(client.options.accessToken).not.toBe(accessToken);

    const { exp: expBefore } = jwt.decode(accessToken);
    const { exp: expAfter } = jwt.decode(client.options.accessToken);

    expect(expAfter).toBeGreaterThan(expBefore);

    expect(
      (await client.getModel(Account).getList()).some(
        (a) => a._id === account._id
      )
    ).toBeTruthy();
  });

  it("parallel refreshToken should refresh accessToken only once", async () => {
    const client = getClient();

    const spy = jest.spyOn(client, "setOptions");

    expect(spy).toBeCalledTimes(0);

    await Promise.all([client.refreshToken(), client.refreshToken()]);

    expect(spy).toBeCalledTimes(1);
  });
});
