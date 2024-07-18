import { ObjectId } from "bson";
import { Client, ClientAdapter } from "@graphand/client";
import ModuleRealtime from "./ModuleRealtime";
import { Socket } from "socket.io-client";
import { controllersMap, DataModel, FieldTypes, Model, ModelCrudEvent } from "@graphand/core";
import RealtimeUpload from "./lib/RealtimeUpload";

describe("ModuleRealtime", () => {
  let client: Client<[typeof ModuleRealtime]>;

  beforeEach(() => {
    client = new Client([[ModuleRealtime]], {
      endpoint: process.env.ENDPOINT,
      ssl: process.env.SSL !== "0",
      accessToken: process.env.ACCESS_TOKEN,
      project: process.env.PROJECT,
      headers: {
        "X-Access-Key": process.env.ACCESS_KEY,
      },
    });
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

    it("should auto subscribe to models", async () => {
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.getModel("testModel");
      expect(_module.getSubscribedModels()).toContain(model.slug);
    });

    it("should auto subscribe to nested models", async () => {
      const fetchSpy = jest.spyOn(global, "fetch");
      const _module = _client.get("realtime");
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const dmTest = DataModel.hydrate({
        _id: new ObjectId().toString(),
        slug: "test",
        definition: {
          keyField: "title",
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
            rel: {
              type: FieldTypes.RELATION,
              options: {
                ref: "test2",
              },
            },
          },
        },
      });
      const dmTest2 = DataModel.hydrate({
        _id: new ObjectId().toString(),
        slug: "test2",
        definition: {
          keyField: "title",
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });
      fetchSpy.mockImplementation(async (args: any) => {
        if (args.url.includes("datamodels/query")) {
          const body = await args.json();
          const slug = body.filter.slug;
          const found = [dmTest, dmTest2].find(d => d.slug === slug);
          return new Response(JSON.stringify({ data: { rows: [found?.toJSON()], count: 1 } }));
        }

        return null;
      });
      expect(_module.getSubscribedModels()).toHaveLength(0);
      const model = _client.getModel("test") as typeof Model & {
        definition: {
          keyField: "title";
          fields: {
            title: {
              type: FieldTypes.TEXT;
            };
            rel: {
              type: FieldTypes.RELATION;
              options: {
                ref: "test2";
              };
            };
          };
        };
      };
      expect(_module.getSubscribedModels()).toContain("test");
      await model.initialize();
      expect(_module.getSubscribedModels()).toContain("datamodels"); // Datamodel model has been used to initialize the model
      expect(_module.getSubscribedModels()).not.toContain("test2"); // At this step, test2 model has not been used
      const i = model.hydrate({ title: "test", rel: new ObjectId().toString() });
      await i.rel.catch(() => null);
      expect(_module.getSubscribedModels()).toContain("test2");
      fetchSpy.mockRestore();
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

    const res = await client.execute(controllersMap.modelCreate, {
      path: { model: "medias" },
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
