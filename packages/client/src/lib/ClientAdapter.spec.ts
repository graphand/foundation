import { ObjectId } from "bson";
import { Client } from "./Client";
import { ClientAdapter } from "./ClientAdapter";
import {
  FieldTypes,
  Model,
  ModelCrudEvent,
  modelDecorator,
  ModelDefinition,
  PromiseModel,
  ValidationError,
} from "@graphand/core";

describe("ClientAdapter", () => {
  @modelDecorator()
  class MockModel extends Model {
    static slug = "mockModel";
    static definition = {
      fields: {
        name: {
          type: FieldTypes.TEXT,
        },
      },
    };
  }

  let client: Client;
  let model: typeof MockModel;
  let adapter: ClientAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new Client([], {
      accessToken: "...",
      project: null,
    });

    model = client.getModel(MockModel);
    adapter = model.getAdapter() as ClientAdapter;
    jest.spyOn(global, "fetch");
    fetchMock = global.fetch as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should fetch count correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": 5}'));
    expect(await model.count()).toBe(5);
  });

  it("should fetch a single model correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
    const result = await model.get("123");
    expect(result).toBeInstanceOf(MockModel);
    expect(result?.get("_id")).toBe("123");
    expect(result?.get("name")).toBe("Test");
  });

  it("should fetch a list of models correctly", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
      ),
    );
    const result = await model.getList();
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(MockModel);
    expect(result[0]?.get("name")).toBe("Test1");
    expect(result[1]?.get("name")).toBe("Test2");
  });

  it("should create a single model correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
    const result = await model.create({ name: "NewTest" });
    expect(result).toBeInstanceOf(MockModel);
    expect(result.get("_id")).toBe("123");
    expect(result.get("name")).toBe("NewTest");
  });

  it("should create multiple models correctly", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
    );
    const result = await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(MockModel);
    expect(result[0]?.get("name")).toBe("Test1");
    expect(result[1]?.get("name")).toBe("Test2");
  });

  it("should update a single model correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
    const result = await model.update("123", { $set: { name: "UpdatedTest" } });
    expect(result).toBeInstanceOf(Array);
    const first = result[0];
    expect(first).toBeInstanceOf(MockModel);
    expect(first?.get("_id")).toBe("123");
    expect(first?.get("name")).toBe("UpdatedTest");
  });

  it("should update a single model correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
    const i = await model.get("123");
    const body = JSON.stringify({
      data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
    });
    fetchMock.mockResolvedValueOnce(new Response(body));
    await i.update({ $set: { name: "UpdatedTest" } });
    expect(i.get("name")).toBe("UpdatedTest");
  });

  it("should update multiple models correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
    const i = await model.get("123");
    const body = JSON.stringify({
      data: [
        { _id: "123", name: "Updated1", _updatedAt: new Date(Date.now() + 10).toJSON() },
        { _id: "456", name: "Updated2", _updatedAt: new Date(Date.now() + 10).toJSON() },
      ],
    });
    fetchMock.mockResolvedValueOnce(new Response(body));
    const result = await model.update({ ids: ["123", "456"] }, { $set: { name: "Updated" } });
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(MockModel);
    expect(result[0]).toBe(i); // The returned instance should be the cached instance
    expect(result[0]?.get("name")).toBe("Updated1");
    expect(result[1]?.get("name")).toBe("Updated2");
    expect(i.get("name")).toBe("Updated1"); // Should have updated the cached instance
  });

  it("should delete a single model correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
    const result = await model.delete("123");
    expect(result).toBeInstanceOf(Array);
    expect(result[0]).toBe("123");
  });

  it("should delete multiple models correctly", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": ["123", "456"]}'));
    const result = await model.delete({ ids: ["123", "456"] });
    expect(result).toEqual(["123", "456"]);
  });

  it("should handle errors correctly", async () => {
    fetchMock.mockRejectedValueOnce(new Error("API Error"));
    await expect(model.get("123")).rejects.toThrow("API Error");
  });

  it("should handle validation errors correctly", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            type: "ValidationError",
            message: "Validation failed with 1 model validator (required) on path name",
            fieldsPaths: ["name"],
            reason: {
              fields: [],
              validators: [
                {
                  validator: {
                    type: "required",
                    options: {
                      field: "name",
                    },
                    path: null,
                  },
                },
              ],
            },
            code: "VALIDATION_FAILED",
            httpStatusCode: 400,
          },
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const p1 = model.create({ name: "" });
    await expect(p1).rejects.toThrow(ValidationError);
    const e: ValidationError = await p1.catch(e => e);
    expect(e.fieldsPaths).toEqual(["name"]);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            type: "ValidationError",
            message: "Validation failed with 1 model validator (required) on path name",
            fieldsPaths: ["name"],
            reason: {
              fields: [
                {
                  slug: "arr",
                  field: {
                    type: "array",
                    options: {
                      items: {
                        type: "nested",
                      },
                    },
                    path: "obj.nested.arr",
                  },
                },
              ],
              validators: [],
            },
            code: "VALIDATION_FAILED",
            httpStatusCode: 400,
          },
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const p2 = model.create({ name: "" });
    await expect(p2).rejects.toThrow(ValidationError);
    const e2: ValidationError = await p2.catch(e => e);
    expect(e2.fieldsPaths).toEqual(["obj.nested.arr"]);
  });

  it("should use local cache when available", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
    await model.get("123");
    const result = await model.get("123");
    expect(result?.get("name")).toBe("Test");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should update local cache when fetching a model", async () => {
    const body = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
    fetchMock.mockResolvedValueOnce(new Response(body));
    const result = await model.get("123");
    expect(result?.get("name")).toBe("Test");
    const body2 = JSON.stringify({
      data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
    });
    fetchMock.mockResolvedValueOnce(new Response(body2));
    await model.get("123", { disableCache: true });
    expect(result?.get("name")).toBe("UpdatedTest");
  });

  it("should handle single models correctly", async () => {
    @modelDecorator()
    class MockModelSingle extends Model {
      static slug = "mockModelSingle" as const;
      static definition = {
        ...MockModel.definition,
        single: true,
      };
    }
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "single", "name": "SingleTest"}}'));
    const result = await client.getModel(MockModelSingle).get({});
    expect(result).toBeInstanceOf(MockModelSingle);
    expect(result?.get("_id")).toBe("single");
    expect(result?.get("name")).toBe("SingleTest");
  });

  it("should throw error when dispatching an event for the wrong model", () => {
    const event: ModelCrudEvent = {
      operation: "create",
      model: "otherModel",
      ids: ["123"],
      data: [{ _id: "123" }],
    };

    expect(() => adapter.dispatch(event)).toThrow("Invalid model");
  });

  it("should dispatch events on create", async () => {
    const eventSpy = jest.spyOn(adapter, "dispatch");
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
    await model.create({ name: "Test" });
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "create",
        model: "mockModel",
        ids: ["123"],
        data: [{ _id: "123", name: "Test" }],
      }),
    );
  });

  it("should dispatch events on update", async () => {
    const eventSpy = jest.spyOn(adapter, "dispatch");
    fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
    await model.update("123", { $set: { name: "UpdatedTest" } });
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "update",
        model: "mockModel",
        ids: ["123"],
        data: [{ _id: "123", name: "UpdatedTest" }],
      }),
    );
  });

  it("should dispatch events on delete", async () => {
    const eventSpy = jest.spyOn(adapter, "dispatch");
    fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
    await model.delete("123");
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "delete",
        model: "mockModel",
        ids: ["123"],
        data: null,
      }),
    );
  });

  describe("Cache", () => {
    it("should add instance to cache after get", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      const _adapter = model.getAdapter() as ClientAdapter;
      expect(_adapter.instancesMap.has("123")).toBeTruthy();
    });

    it("should add instances to cache after getList", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();
      const _adapter = model.getAdapter() as ClientAdapter;
      expect(_adapter.instancesMap.has("123")).toBeTruthy();
      expect(_adapter.instancesMap.has("456")).toBeTruthy();
    });

    it("should not update cache if new instance has older _updatedAt", async () => {
      const oldDate = new Date();
      const newDate = new Date(oldDate.getTime() + 10000);
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "Test", "_updatedAt": "${newDate.toJSON()}"}}`),
      );
      await model.get("123");
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "OldTest", "_updatedAt": "${oldDate.toJSON()}"}}`),
      );
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
    });

    it("should update cache if new instance has newer _updatedAt", async () => {
      const oldDate = new Date();
      const newDate = new Date(oldDate.getTime() + 10000);
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "Test", "_updatedAt": "${oldDate.toJSON()}"}}`),
      );
      await model.get("123");
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "NewTest", "_updatedAt": "${newDate.toJSON()}"}}`),
      );
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("NewTest");
    });

    it("should add to cache if instance doesn't exist", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      expect(adapter.instancesMap.has("123")).toBeTruthy();
    });

    it("should not add to cache if payload doesn't have _id", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"name": "Test"}}'));
      await model.get("123");
      expect(adapter.instancesMap.size).toBe(0);
    });

    it("should update cache on create", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      expect(adapter.instancesMap.has("123")).toBeTruthy();
    });

    it("should update cache on update", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      await new Promise(resolve => setTimeout(resolve, 1));
      const body2 = JSON.stringify({
        data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.update("123", { $set: { name: "UpdatedTest" } });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("UpdatedTest");
    });

    it("should remove from cache on delete", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(adapter.instancesMap.has("123")).toBeFalsy();
    });

    it("should not update cache if _updatedAt is missing in new data", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      const body2 = JSON.stringify({ data: { _id: "123", name: "NewTest" } });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
    });

    it("should use __fetchedAt to determine if cache is outdated", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test" } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      const i = await model.get("123");
      expect(i.__fetchedAt?.getTime()).toEqual(i.__getAge());
      const body2 = JSON.stringify({ data: { _id: "123", name: "NewTest", _updatedAt: i.__fetchedAt } });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
      const body3 = JSON.stringify({
        data: { _id: "123", name: "NewTest", _updatedAt: new Date(i.__fetchedAt.getTime() + 10) },
      });
      fetchMock.mockResolvedValueOnce(new Response(body3));
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("NewTest");
    });

    it("should update cache if existing instance doesn't have _updatedAt", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      const body2 = JSON.stringify({
        data: { _id: "123", name: "NewTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("NewTest");
    });

    it("should not update cache if _updatedAt is equal", async () => {
      const updatedAt = "2022-01-01T00:00:00.000Z";
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "Test", "_updatedAt": "${updatedAt}"}}`),
      );
      await model.get("123");
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "NewTest", "_updatedAt": "${updatedAt}"}}`),
      );
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
    });

    it("should handle multiple instances in getList", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();
      expect(adapter.instancesMap.size).toBe(2);
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test1");
      expect(adapter.instancesMap.get("456")?.get("name")).toBe("Test2");
    });

    it("should update only newer instances in getList", async () => {
      const originalDate = new Date();
      const body1 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "Test1", _updatedAt: originalDate.toJSON() },
            { _id: "456", name: "Test2", _updatedAt: originalDate.toJSON() },
          ],
          count: 2,
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.getList();
      const body2 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "NewTest1", _updatedAt: new Date(originalDate.getTime() + 10).toJSON() },
            { _id: "456", name: "NewTest2", _updatedAt: new Date(Date.now() - 1).toJSON() },
          ],
          count: 2,
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.getList({}, { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("NewTest1");
      expect(adapter.instancesMap.get("456")?.get("name")).toBe("Test2");
    });

    it("should handle undefined _updatedAt in cache update", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      const body2 = JSON.stringify({
        data: { _id: "123", name: "NewTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("NewTest");
    });

    it("should not update cache if new instance has invalid _updatedAt", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "Test", "_updatedAt": "2022-01-01T00:00:00.000Z"}}'),
      );
      await model.get("123");
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "NewTest", "_updatedAt": "invalid-date"}}'),
      );
      await model.get("123", { disableCache: true });
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
    });

    it("should handle race conditions in cache updates", async () => {
      const promise1 = model.get("123");
      const promise2 = model.get("123", { disableCache: true });

      const body1 = JSON.stringify({ data: { _id: "123", name: "Test1", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      const body2 = JSON.stringify({
        data: { _id: "123", name: "Test2", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await Promise.all([promise1, promise2]);

      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test2");
    });

    it("should maintain cache consistency across multiple operations", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");

      const body2 = JSON.stringify({
        data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.update("123", { $set: { name: "UpdatedTest" } });

      const body3 = JSON.stringify({
        data: { _id: "123", name: "OldTest", _updatedAt: new Date(Date.now() - 1).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body3));
      await model.get("123", { disableCache: true });

      expect(adapter.instancesMap.get("123")?.get("name")).toBe("UpdatedTest");
    });

    it("should clear cache when clearInstances is called", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      expect(adapter.instancesMap.size).toBe(1);

      adapter.clearInstances();
      expect(adapter.instancesMap.size).toBe(0);
    });

    it("should handle updates with no changes", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "Test", "_updatedAt": "2022-01-01T00:00:00.000Z"}}'),
      );
      await model.get("123");

      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "Test", "_updatedAt": "2022-01-01T00:00:00.000Z"}}'),
      );
      await model.update("123", { $set: { name: "Test" } });

      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test");
    });

    it("should handle createMultiple correctly", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);

      expect(adapter.instancesMap.size).toBe(2);
      expect(adapter.instancesMap.get("123")?.get("name")).toBe("Test1");
      expect(adapter.instancesMap.get("456")?.get("name")).toBe("Test2");
    });

    it("should handle deleteMultiple correctly", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();

      fetchMock.mockResolvedValueOnce(new Response('{"data": ["123", "456"]}'));
      await model.delete({ ids: ["123", "456"] });

      expect(adapter.instancesMap.size).toBe(0);
    });
  });

  describe("Subscribe", () => {
    let subscriber: jest.Mock;

    beforeEach(() => {
      subscriber = jest.fn();
      adapter.subscribe(subscriber);
    });

    afterEach(() => {
      adapter.clearInstances();
      jest.clearAllMocks();
    });

    it("should notify subscribers when a new instance is fetched", async () => {
      adapter.subscribe(subscriber);

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("");

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123"],
        operation: "fetch",
      });
    });

    it("should notify subscribers when multiple instances are fetched", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123", "456"],
        operation: "fetch",
      });
    });

    it("should notify subscribers when an instance is created", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123"],
        operation: "create",
      });
    });

    it("should notify subscribers when multiple instances are created", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123", "456"],
        operation: "create",
      });
    });

    it("should notify subscribers when an instance is updated", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
      await model.update("123", { $set: { name: "UpdatedTest" } });

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123"],
        operation: "update",
      });
    });

    it("should notify subscribers when multiple instances are updated", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "UpdatedTest1"}, {"_id": "456", "name": "UpdatedTest2"}]}'),
      );
      await model.update({ ids: ["123", "456"] }, { $set: { name: "UpdatedTest" } });

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123", "456"],
        operation: "update",
      });
    });

    it("should  subscribers when an instance is deleted", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");

      expect(subscriber.mock.calls[1][0]).toEqual({
        ids: ["123"],
        operation: "delete",
      });
    });

    it("should notify subscribers only deleted instances from cache when multiple instances are deleted", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      fetchMock.mockResolvedValueOnce(new Response('{"data": ["123", "456"]}'));
      await model.delete({ ids: ["123", "456"] });

      expect(subscriber.mock.calls[1][0]).toEqual({
        ids: ["123"],
        operation: "delete",
      });
    });

    it("should not notify subscribers when fetching an already cached instance", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      subscriber.mockClear();

      await model.get("123");

      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should notify subscribers only for updated instances in getList", async () => {
      const originalDate = new Date();
      const body1 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "Test1", _updatedAt: originalDate.toJSON() },
            { _id: "456", name: "Test2", _updatedAt: originalDate.toJSON() },
          ],
          count: 2,
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.getList();
      subscriber.mockClear();

      const body2 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "UpdatedTest1", _updatedAt: new Date(originalDate.getTime() + 10).toJSON() },
            { _id: "456", name: "Test2", _updatedAt: originalDate.toJSON() },
          ],
          count: 2,
        },
      });

      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.getList({}, { disableCache: true });

      expect(subscriber.mock.calls[0][0]).toEqual({
        ids: ["123"],
        operation: "fetch",
      });
    });

    it("should notify subscribers for all operations in sequence", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.create({ name: "Test" });

      const body2 = JSON.stringify({
        data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.update("123", { $set: { name: "UpdatedTest" } });

      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");

      expect(subscriber.mock.calls.length).toBe(3);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "create" });
      expect(subscriber.mock.calls[1][0]).toEqual({ ids: ["123"], operation: "update" });
      expect(subscriber.mock.calls[2][0]).toEqual({ ids: ["123"], operation: "delete" });
    });

    it("should handle multiple subscribers", async () => {
      const secondSubscriber = jest.fn();
      adapter.subscribe(secondSubscriber);

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");

      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
      expect(secondSubscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should allow unsubscribing", async () => {
      const unsubscribe = adapter.subscribe(subscriber);
      unsubscribe();

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");

      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should notify subscribers when updating an instance with newer _updatedAt", async () => {
      const oldDate = new Date();
      const newDate = new Date(oldDate.getTime() + 10000);
      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "Test", "_updatedAt": "${oldDate.toJSON()}"}}`),
      );
      await model.get("123");
      subscriber.mockClear();

      fetchMock.mockResolvedValueOnce(
        new Response(`{"data": {"_id": "123", "name": "UpdatedTest", "_updatedAt": "${newDate.toJSON()}"}}`),
      );
      await model.get("123", { disableCache: true });

      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should not notify subscribers when updating an instance with older _updatedAt", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "Test", "_updatedAt": "2022-01-02T00:00:00.000Z"}}'),
      );
      await model.get("123");
      subscriber.mockClear();

      fetchMock.mockResolvedValueOnce(
        new Response('{"data": {"_id": "123", "name": "OldTest", "_updatedAt": "2022-01-01T00:00:00.000Z"}}'),
      );
      await model.get("123", { disableCache: true });

      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should not notify subscribers when no instances are affected by an operation", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": []}'));
      await model.update({ ids: [] }, { $set: { name: "UpdatedTest" } });

      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should notify subscribers when an instance is added to the cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
      await model.get("123");
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should notify subscribers when a new instance is created and added to cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
      await model.create({ name: "NewTest" });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "create" });
    });

    it("should not notify subscribers when a fetched instance is already in cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      subscriber.mockClear();

      await model.get("123");
      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should notify subscribers when a fetched instance has a newer _updatedAt", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      subscriber.mockClear();

      const body2 = JSON.stringify({
        data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should notify subscribers only for updated instances in getList", async () => {
      const originalDate = new Date();
      const body1 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "Test1", _updatedAt: originalDate.toJSON() },
            { _id: "456", name: "Test2", _updatedAt: originalDate.toJSON() },
          ],
          count: 2,
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.getList();
      subscriber.mockClear();

      const body2 = JSON.stringify({
        data: {
          rows: [
            { _id: "123", name: "UpdatedTest1", _updatedAt: new Date(Date.now() + 10).toJSON() },
            { _id: "456", name: "Test2", _updatedAt: originalDate.toJSON() },
          ],
          count: 2,
        },
      });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.getList({}, { disableCache: true });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should notify subscribers when multiple instances are created", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123", "456"], operation: "create" });
    });

    it("should notify subscribers when an instance is updated with new data", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.create({ name: "Test" });
      subscriber.mockClear();

      const body2 = JSON.stringify({
        data: { _id: "123", name: "UpdatedTest", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });

      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.update("123", { $set: { name: "UpdatedTest" } });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "update" });
    });

    it("should notify subscribers when multiple instances are updated", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "UpdatedTest1"}, {"_id": "456", "name": "UpdatedTest2"}]}'),
      );
      await model.update({ ids: ["123", "456"] }, { $set: { name: "UpdatedTest" } });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123", "456"], operation: "update" });
    });

    it("should notify subscribers when an instance is deleted from cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      subscriber.mockClear();

      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "delete" });
    });

    it("should not notify subscribers when deleting an instance not in cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should allow multiple subscribers and notify all of them", async () => {
      const secondSubscriber = jest.fn();
      adapter.subscribe(secondSubscriber);

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });

      expect(subscriber.mock.calls.length).toBe(1);
      expect(secondSubscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "create" });
      expect(secondSubscriber.mock.calls[0][0]).toEqual({ ids: ["123"], operation: "create" });
    });
  });

  describe("Populated data", () => {
    @modelDecorator()
    class RelatedModel extends Model {
      static slug = "relatedModel";
      static definition = {
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      } satisfies ModelDefinition;
    }

    @modelDecorator()
    class MockModelWithRelation extends Model {
      static slug = "mockModelWithRelation";
      static definition = {
        fields: {
          name: {
            type: FieldTypes.TEXT,
          },
          related: {
            type: FieldTypes.RELATION,
            options: {
              ref: RelatedModel.slug,
            },
            _tsModel: undefined as typeof RelatedModel,
          },
        },
      } satisfies ModelDefinition;
    }

    let modelRelated: typeof RelatedModel;
    let modelWithRelation: typeof MockModelWithRelation;
    let adapterRelated: ClientAdapter;
    let adapterWithRelation: ClientAdapter;

    beforeEach(() => {
      modelRelated = client.getModel(RelatedModel);
      modelWithRelation = client.getModel(MockModelWithRelation);
      adapterRelated = modelRelated.getAdapter() as ClientAdapter;
      adapterWithRelation = modelWithRelation.getAdapter() as ClientAdapter;
    });

    it("should process and cache populated data", async () => {
      const relatedId = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        related: {
          _id: relatedId,
          title: "Related Title",
        },
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result).toBeInstanceOf(MockModelWithRelation);
      expect(result.get("name")).toBe("Test");
      expect(result.getData().related).toBe(relatedId);
      expect(adapterWithRelation.instancesMap.get(relatedId)).toBeUndefined();
      expect(adapterRelated.instancesMap.get(relatedId)).toBeInstanceOf(RelatedModel);
      expect(result.get("related")).toBeInstanceOf(PromiseModel);
      expect(result.get("related").cached).toBeInstanceOf(RelatedModel);
    });
  });
});
