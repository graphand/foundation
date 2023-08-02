import { Model } from "@graphand/core";
import { getClient } from "../../lib/test-utils";

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

  it("initialize", async () => {
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
});
