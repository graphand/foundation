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
});
