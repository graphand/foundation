import { ObjectId } from "bson";
import { vi, MockInstance } from "vitest";
import { faker } from "@faker-js/faker";
import { Client, ClientAdapter } from "@graphand/client";
import ModuleRealtime from "./ModuleRealtime.js";
import { Socket } from "socket.io-client";
import { controllerModelCreate, ModelCrudEvent, UploadEvent } from "@graphand/core";
import RealtimeUpload from "./lib/RealtimeUpload.js";
import { Server } from "socket.io";

describe("ModuleRealtime", () => {
  let client: Client<{}, [typeof ModuleRealtime]>;
  let spyFetch: MockInstance;
  let io: Server;

  beforeAll(() => {
    io = new Server(3000, {});

    spyFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async req => {
      if (!(req instanceof Request)) {
        return new Response();
      }

      const url = new URL(req.url);

      if (url.pathname === "/datamodels/query") {
        return new Response(JSON.stringify({ data: { rows: [], count: 0 } }));
      }

      if (url.pathname === "/medias") {
        const uploadId = req.headers.get("Upload-Id");
        // emit event
        if (uploadId) {
          const progressEvent: UploadEvent = {
            type: "progress",
            uploadId,
            receivedLength: 0,
          };
          io.emit("upload:event", progressEvent);

          const endEvent: UploadEvent = {
            type: "end",
            uploadId,
            receivedLength: 0,
          };
          io.emit("upload:event", endEvent);
        }

        return new Response(JSON.stringify({ data: { _id: new ObjectId().toString() } }));
      }

      return new Response(JSON.stringify({ data: {} }));
    });
  });

  afterAll(() => {
    spyFetch.mockRestore();
    io.close();
  });

  beforeEach(() => {
    client = new Client(
      {
        endpoint: "127.0.0.1:3000",
        ssl: false,
        accessToken: faker.internet.password(),
        project: null,
      },
      [[ModuleRealtime]],
    );
  });

  afterEach(() => {
    client.destroy();
  });

  it("should throw an error when connecting without an access token", () => {
    // @ts-ignore
    const _client = client.clone({ accessToken: null });
    expect(() => _client.get("realtime").connect()).toThrow("Access token is required to connect to the socket");
    _client.destroy();
  });

  it("should connect automatically when autoConnect is true (default)", async () => {
    await client.init();
    expect(client.get("realtime").getSocket(false)).toBeInstanceOf(Socket);
  });

  it("should not connect automatically when autoConnect is false", async () => {
    const _client = new Client(client.options, [[ModuleRealtime, { autoConnect: false }]]);
    await _client.init();
    expect(_client.get("realtime").getSocket(false)).toBeUndefined();
    _client.destroy();
  });

  it("should be able to connect to the socket", async () => {
    const socket = client.get("realtime").getSocket();
    expect(socket).toBeInstanceOf(Socket);
    expect(socket?.connected).toBeFalsy();

    await client.get("realtime").connect();

    expect(socket?.connected).toBeTruthy();

    await client.get("realtime").disconnect();

    expect(socket?.connected).toBeFalsy();
  });

  it("should dispatch ModelCrudEvent on realtime:event", async () => {
    client.get("realtime").subscribeModels(["testModel"]);
    await client.get("realtime").connect();
    const socket = client.get("realtime").getSocket();

    const model = client.model("testModel");
    const adapter = model.getAdapter() as ClientAdapter;
    const mockDispatch = vi.spyOn(adapter, "dispatch");
    const event: ModelCrudEvent = {
      operation: "create",
      model: "testModel",
      ids: ["123"],
      data: [{ _id: "123" }],
    };

    if (!socket) return;

    const [listener] = socket.listeners("realtime:event");

    listener?.(event);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ...event,
        __socketId: socket?.id,
      }),
    );
  });

  it("should subscribe to models", async () => {
    let spyEmit = vi.spyOn(client.get("realtime").getSocket(false) as Socket, "emit");

    client.get("realtime").subscribeModels(["testModel"]);

    await client.get("realtime").connect();

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel");

    client.get("realtime").subscribeModels(["testModel2"]);

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel,testModel2");

    await client.get("realtime").disconnect();

    spyEmit.mockClear();

    expect(spyEmit).not.toHaveBeenCalled();

    await client.get("realtime").connect();

    expect(spyEmit).toHaveBeenCalledWith("subscribeModels", "testModel,testModel2");
  });

  it("should be able to subscribe to upload events", async () => {
    await client.get("realtime").connect();
    const upload = client.get("realtime").getUpload("test");
    expect(upload).toBeInstanceOf(RealtimeUpload);

    const stateSpy = vi.fn();
    const unsub = upload.subscribe(stateSpy);

    const form = new FormData();
    const file = new File(["sample"], "test.txt", { type: "text/plain" });
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

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(res.ok).toBeTruthy();

    expect(stateSpy.mock.calls.length).toBeGreaterThan(2);

    const firstCall = stateSpy.mock.calls?.[0]?.[0];
    const lastCall = stateSpy.mock.calls?.[stateSpy.mock.calls.length - 1]?.[0];

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

  describe("autoSubscribe", () => {
    let _client: Client<{}, [typeof ModuleRealtime]>;

    beforeEach(() => {
      _client = new Client(client.options, [[ModuleRealtime, { autoSubscribe: true, autoConnect: false }]]);
    });

    it("should auto subscribe to models on Model.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.model("testModel");
      model.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });

    it("should auto subscribe to models on Model.prototype.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.model("testModel");
      const i = model.hydrate({});
      i.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });

    it("should auto subscribe to models on ModelList.prototype.subscribe", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.model("datamodels");
      const list = await model.getList({});
      list.subscribe(() => {});
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });
  });
});
