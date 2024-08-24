import { Client, ClientAdapter, ClientModules, ClientOptions, ModuleConstructor } from "@graphand/client";
import ModuleRealtime from "./ModuleRealtime";
import { Socket } from "socket.io-client";
import { controllerModelCreate, ModelCrudEvent } from "@graphand/core";
import RealtimeUpload from "./lib/RealtimeUpload";

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

describe("ModuleRealtime", () => {
  let client: Client<[typeof ModuleRealtime]>;

  beforeEach(() => {
    client = createClient([[ModuleRealtime]]);
  });

  afterEach(() => {
    client.destroy();
  });

  it("should throw an error when connecting without an access token", () => {
    const _client = client.clone({ accessToken: null });
    expect(() => _client.get("realtime").connect()).toThrow("Access token is required to connect to the socket");
    _client.destroy();
  });

  it("should connect automatically when autoConnect is true (default)", async () => {
    await client.init();
    expect(client.get("realtime").getSocket(false)).toBeInstanceOf(Socket);
  });

  it("should not connect automatically when autoConnect is false", async () => {
    const _client = new Client([[ModuleRealtime, { autoConnect: false }]], client.options);
    await _client.init();
    expect(_client.get("realtime").getSocket(false)).toBeUndefined();
    _client.destroy();
  });

  it("should be able to connect to the socket", async () => {
    const socket = client.get("realtime").getSocket();
    expect(socket).toBeInstanceOf(Socket);
    expect(socket.connected).toBeFalsy();

    await client.get("realtime").connect();

    expect(socket.connected).toBeTruthy();

    await client.get("realtime").disconnect();

    expect(socket.connected).toBeFalsy();
  });

  it("should dispatch ModelCrudEvent on realtime:event", async () => {
    client.get("realtime").subscribeModels(["testModel"]);
    await client.get("realtime").connect();
    const socket = client.get("realtime").getSocket();

    const model = client.getModel("testModel");
    const adapter = model.getAdapter() as ClientAdapter;
    const mockDispatch = jest.spyOn(adapter, "dispatch");
    const event: ModelCrudEvent = {
      operation: "create",
      model: "testModel",
      ids: ["123"],
      data: [{ _id: "123" }],
    };

    const [listener] = socket.listeners("realtime:event");

    listener(event);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ...event,
        __socketId: socket.id,
      }),
    );
  });

  it("should subscribe to models", async () => {
    let spyEmit = jest.spyOn(client.get("realtime").getSocket(false), "emit");

    client.get("realtime").subscribeModels(["testModel"]);

    await client.get("realtime").connect();

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel");

    client.get("realtime").subscribeModels(["testModel2"]);

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel,testModel2");

    await client.get("realtime").disconnect();

    spyEmit = jest.spyOn(client.get("realtime").getSocket(false), "emit");

    await client.get("realtime").connect();

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel,testModel2");
  });

  describe("autoSubscribe", () => {
    let _client: Client<[typeof ModuleRealtime]>;

    beforeEach(() => {
      _client = new Client([[ModuleRealtime, { autoSubscribe: true, autoConnect: false }]], client.options);
    });

    it("should auto subscribe to models on Model.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.getModel("testModel");
      model.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });

    it("should auto subscribe to models on Model.prototype.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.getModel("testModel");
      const i = model.hydrate({});
      i.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });

    it("should auto subscribe to models on ModelList.prototype.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.getModel("datamodels");
      const list = await model.getList({});
      list.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });
  });

  it("should be able to subscribe to upload events", async () => {
    await client.get("realtime").connect();
    const upload = client.get("realtime").getUpload("test");
    expect(upload).toBeInstanceOf(RealtimeUpload);

    const stateSpy = jest.fn();
    const unsub = upload.subscribe(stateSpy);

    await new Promise(resolve => setTimeout(resolve, 500));

    const form = new FormData();
    const array = new Array(5000).fill("a");
    const file = new File(array, "test.txt", { type: "text/plain" });
    form.append("file", file);

    const res = await client.execute(controllerModelCreate, {
      params: { model: "medias" },
      init: {
        body: form,
        headers: {
          "Upload-Id": upload.id,
        },
      },
    });

    expect(res.ok).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(stateSpy.mock.calls.length).toBeGreaterThan(2);

    const firstCall = stateSpy.mock.calls[0][0];
    const lastCall = stateSpy.mock.calls[stateSpy.mock.calls.length - 1][0];

    expect(firstCall).toEqual(
      expect.objectContaining({
        status: "pending",
        percentage: 0,
      }),
    );

    expect(lastCall).toEqual(
      expect.objectContaining({
        status: "success",
        percentage: 100,
      }),
    );

    unsub();
  });
});
