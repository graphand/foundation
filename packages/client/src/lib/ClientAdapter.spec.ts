import { Mock, MockInstance, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { ObjectId } from "bson";
import { Client } from "./Client.js";
import { ClientAdapter } from "./ClientAdapter.js";
import {
  createValidationError,
  DataModel,
  FieldTypes,
  Model,
  ModelCrudEvent,
  modelDecorator,
  ModelDefinition,
  ModelInstance,
  ModelList,
  PromiseModel,
  PromiseModelList,
  ValidationError,
  ValidatorTypes,
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
  let fetchMock: MockInstance;

  beforeEach(() => {
    client = new Client([], {
      accessToken: "...",
      project: null,
    });

    model = client.getModel(MockModel);
    adapter = model.getAdapter() as unknown as ClientAdapter;
    fetchMock = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
          error: createValidationError({
            type: ValidatorTypes.REQUIRED,
            options: { field: "name" },
          }).toJSON(),
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
                  type: "ValidationFieldError",
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
    const eventSpy = vi.spyOn(adapter, "dispatch");
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
    const eventSpy = vi.spyOn(adapter, "dispatch");
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
    const eventSpy = vi.spyOn(adapter, "dispatch");
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
      const _adapter = model.getAdapter() as unknown as ClientAdapter;
      expect(_adapter.store.has("123")).toBeTruthy();
    });

    it("should add instances to cache after getList", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();
      const _adapter = model.getAdapter() as unknown as ClientAdapter;
      expect(_adapter.store.has("123")).toBeTruthy();
      expect(_adapter.store.has("456")).toBeTruthy();
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
      expect(adapter.store.get("123")?.get("name")).toBe("Test");
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
      expect(adapter.store.get("123")?.get("name")).toBe("NewTest");
    });

    it("should add to cache if instance doesn't exist", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      expect(adapter.store.has("123")).toBeTruthy();
    });

    it("should not add to cache if payload doesn't have _id", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"name": "Test"}}'));
      await model.get("123");
      expect(adapter.store.size).toBe(0);
    });

    it("should update cache on create", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      expect(adapter.store.has("123")).toBeTruthy();
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
      expect(adapter.store.get("123")?.get("name")).toBe("UpdatedTest");
    });

    it("should remove from cache on delete", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(adapter.store.has("123")).toBeFalsy();
    });

    it("should not update cache if _updatedAt is missing in new data", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test", _updatedAt: new Date().toJSON() } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      await model.get("123");
      const body2 = JSON.stringify({ data: { _id: "123", name: "NewTest" } });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.store.get("123")?.get("name")).toBe("Test");
    });

    it("should use __fetchedAt to determine if cache is outdated", async () => {
      const body1 = JSON.stringify({ data: { _id: "123", name: "Test" } });
      fetchMock.mockResolvedValueOnce(new Response(body1));
      const i = await model.get("123");
      expect(i.__fetchedAt?.getTime()).toEqual(i.__getAge());
      const body2 = JSON.stringify({ data: { _id: "123", name: "NewTest", _updatedAt: i.__fetchedAt } });
      fetchMock.mockResolvedValueOnce(new Response(body2));
      await model.get("123", { disableCache: true });
      expect(adapter.store.get("123")?.get("name")).toBe("Test");
      const body3 = JSON.stringify({
        // @ts-ignore
        data: { _id: "123", name: "NewTest", _updatedAt: new Date(i.__fetchedAt?.getTime() + 10) },
      });
      fetchMock.mockResolvedValueOnce(new Response(body3));
      await model.get("123", { disableCache: true });
      expect(adapter.store.get("123")?.get("name")).toBe("NewTest");
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
      expect(adapter.store.get("123")?.get("name")).toBe("NewTest");
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
      expect(adapter.store.get("123")?.get("name")).toBe("Test");
    });

    it("should handle multiple instances in getList", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await model.getList();
      expect(adapter.store.size).toBe(2);
      expect(adapter.store.get("123")?.get("name")).toBe("Test1");
      expect(adapter.store.get("456")?.get("name")).toBe("Test2");
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
      expect(adapter.store.get("123")?.get("name")).toBe("NewTest1");
      expect(adapter.store.get("456")?.get("name")).toBe("Test2");
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
      expect(adapter.store.get("123")?.get("name")).toBe("NewTest");
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
      expect(adapter.store.get("123")?.get("name")).toBe("Test");
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

      expect(adapter.store.get("123")?.get("name")).toBe("Test2");
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

      expect(adapter.store.get("123")?.get("name")).toBe("UpdatedTest");
    });

    it("should clear cache when clearInstances is called", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");
      expect(adapter.store.size).toBe(1);

      adapter.clearInstances();
      expect(adapter.store.size).toBe(0);
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

      expect(adapter.store.get("123")?.get("name")).toBe("Test");
    });

    it("should handle createMultiple correctly", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);

      expect(adapter.store.size).toBe(2);
      expect(adapter.store.get("123")?.get("name")).toBe("Test1");
      expect(adapter.store.get("456")?.get("name")).toBe("Test2");
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

      expect(adapter.store.size).toBe(0);
    });
  });

  describe("Subscribe", () => {
    let subscriber: Mock;

    beforeEach(() => {
      subscriber = vi.fn();
      adapter.subscribe(subscriber);
    });

    afterEach(() => {
      adapter.clearInstances();
      vi.clearAllMocks();
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

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123", "456"],
        operation: "fetch",
      });
    });

    it("should notify subscribers when an instance is created", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123"],
        operation: "create",
      });
    });

    it("should notify subscribers when multiple instances are created", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123", "456"],
        operation: "create",
      });
    });

    it("should notify subscribers when an instance is updated", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
      await model.update("123", { $set: { name: "UpdatedTest" } });

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123"],
        operation: "update",
      });
    });

    it("should notify subscribers when multiple instances are updated", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "UpdatedTest1"}, {"_id": "456", "name": "UpdatedTest2"}]}'),
      );
      await model.update({ ids: ["123", "456"] }, { $set: { name: "UpdatedTest" } });

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
        ids: ["123", "456"],
        operation: "update",
      });
    });

    it("should  subscribers when an instance is deleted", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");

      expect(subscriber.mock.calls?.[1]?.[0]).toEqual({
        ids: ["123"],
        operation: "delete",
      });
    });

    it("should notify subscribers only deleted instances from cache when multiple instances are deleted", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      fetchMock.mockResolvedValueOnce(new Response('{"data": ["123", "456"]}'));
      await model.delete({ ids: ["123", "456"] });

      expect(subscriber.mock.calls?.[1]?.[0]).toEqual({
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

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({
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
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "create" });
      expect(subscriber.mock.calls?.[1]?.[0]).toEqual({ ids: ["123"], operation: "update" });
      expect(subscriber.mock.calls?.[2]?.[0]).toEqual({ ids: ["123"], operation: "delete" });
    });

    it("should handle multiple subscribers", async () => {
      const secondSubscriber = vi.fn();
      adapter.subscribe(secondSubscriber);

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.get("123");

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
      expect(secondSubscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
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

      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
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
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should notify subscribers when a new instance is created and added to cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
      await model.create({ name: "NewTest" });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "create" });
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
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
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
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "fetch" });
    });

    it("should notify subscribers when multiple instances are created", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}]}'),
      );
      await model.createMultiple([{ name: "Test1" }, { name: "Test2" }]);
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123", "456"], operation: "create" });
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
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "update" });
    });

    it("should notify subscribers when multiple instances are updated", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "UpdatedTest1"}, {"_id": "456", "name": "UpdatedTest2"}]}'),
      );
      await model.update({ ids: ["123", "456"] }, { $set: { name: "UpdatedTest" } });
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123", "456"], operation: "update" });
    });

    it("should notify subscribers when an instance is deleted from cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });
      subscriber.mockClear();

      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(subscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "delete" });
    });

    it("should not notify subscribers when deleting an instance not in cache", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": true}'));
      await model.delete("123");
      expect(subscriber.mock.calls.length).toBe(0);
    });

    it("should allow multiple subscribers and notify all of them", async () => {
      const secondSubscriber = vi.fn();
      adapter.subscribe(secondSubscriber);

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await model.create({ name: "Test" });

      expect(subscriber.mock.calls.length).toBe(1);
      expect(secondSubscriber.mock.calls.length).toBe(1);
      expect(subscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "create" });
      expect(secondSubscriber.mock.calls?.[0]?.[0]).toEqual({ ids: ["123"], operation: "create" });
    });
  });

  describe("Populated data", () => {
    @modelDecorator()
    class OtherRelatedModel extends Model {
      static slug = "otherRelatedModel";
      static definition = {
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      } satisfies ModelDefinition;
    }

    @modelDecorator()
    class RelatedModel extends Model {
      static slug = "relatedModel";
      static definition = {
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
          other: {
            type: FieldTypes.RELATION,
            options: {
              ref: OtherRelatedModel.slug,
            },
            _tsModel: undefined as unknown as typeof OtherRelatedModel,
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
            _tsModel: undefined as unknown as typeof RelatedModel,
          },
          multiRelated: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.RELATION,
                options: {
                  ref: RelatedModel.slug,
                },
              },
              distinct: true,
            },
          },
          nested: {
            type: FieldTypes.NESTED,
            options: {
              fields: {
                related: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: RelatedModel.slug,
                  },
                  _tsModel: undefined as unknown as typeof RelatedModel,
                },
                multiRelated: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: RelatedModel.slug,
                      },
                      _tsModel: undefined as unknown as typeof RelatedModel,
                    },
                    distinct: true,
                  },
                },
                circular: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: RelatedModel.slug,
                  },
                  _tsModel: undefined as unknown as typeof RelatedModel,
                },
              },
            },
          },
          nestedArr: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.NESTED,
                options: {
                  fields: {
                    related: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: RelatedModel.slug,
                      },
                      _tsModel: undefined as unknown as typeof RelatedModel,
                    },
                    multiRelated: {
                      type: FieldTypes.ARRAY,
                      options: {
                        items: {
                          type: FieldTypes.RELATION,
                          options: {
                            ref: RelatedModel.slug,
                          },
                          _tsModel: undefined as unknown as typeof RelatedModel,
                        },
                        distinct: true,
                      },
                    },
                    circular: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: RelatedModel.slug,
                      },
                      _tsModel: undefined as unknown as typeof RelatedModel,
                    },
                  },
                },
              },
            },
          },
        },
      } satisfies ModelDefinition;
    }

    let modelRelated: typeof RelatedModel;
    let modelOtherRelated: typeof OtherRelatedModel;
    let modelWithRelation: typeof MockModelWithRelation;
    let adapterRelated: ClientAdapter;
    let adapterOtherRelated: ClientAdapter;
    let adapterWithRelation: ClientAdapter;

    beforeEach(() => {
      modelRelated = client.getModel(RelatedModel);
      modelOtherRelated = client.getModel(OtherRelatedModel);
      modelWithRelation = client.getModel(MockModelWithRelation);
      adapterRelated = modelRelated.getAdapter() as unknown as ClientAdapter;
      adapterOtherRelated = modelOtherRelated.getAdapter() as unknown as ClientAdapter;
      adapterWithRelation = modelWithRelation.getAdapter() as unknown as ClientAdapter;
    });

    it("should process and cache populated data for a single relation", async () => {
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
      expect(adapterWithRelation.store.get(relatedId)).toBeUndefined();
      expect(adapterRelated.store.get(relatedId)).toBeInstanceOf(RelatedModel);
      expect(result.related).toBeInstanceOf(PromiseModel);
      expect(result.related?.cached).toBeInstanceOf(RelatedModel);
    });

    it("should process and cache populated data for multiple relations", async () => {
      const relatedId1 = new ObjectId().toString();
      const relatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        multiRelated: [
          { _id: relatedId1, title: "Related Title 1" },
          { _id: relatedId2, title: "Related Title 2" },
        ],
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result).toBeInstanceOf(MockModelWithRelation);
      expect(result.get("name")).toBe("Test");
      expect(result.getData().multiRelated).toEqual([relatedId1, relatedId2]);
      expect(adapterRelated.store.get(relatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterRelated.store.get(relatedId2)).toBeInstanceOf(RelatedModel);
      expect(result.multiRelated).toBeInstanceOf(PromiseModelList);
      expect(result.multiRelated?.cached).toBeInstanceOf(ModelList);
      expect(result.multiRelated?.cached?.length).toBe(2);
      expect(result.multiRelated?.cached?.[0]).toBeInstanceOf(RelatedModel);
      expect(result.multiRelated?.cached?.[1]).toBeInstanceOf(RelatedModel);
    });

    it("should handle nested populated data with single relation", async () => {
      const nestedRelatedId = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        nested: {
          related: {
            _id: nestedRelatedId,
            title: "Nested Related Title",
          },
        },
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result).toBeInstanceOf(MockModelWithRelation);
      expect(result.get("name")).toBe("Test");
      expect(result.getData().nested.related).toBe(nestedRelatedId);
      expect(adapterRelated.store.get(nestedRelatedId)).toBeInstanceOf(RelatedModel);
      expect(result.nested?.related).toBeInstanceOf(PromiseModel);
      expect(result.nested?.related?.cached).toBeInstanceOf(RelatedModel);
    });

    it("should handle nested populated data with multiple relations", async () => {
      const nestedRelatedId1 = new ObjectId().toString();
      const nestedRelatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        nested: {
          multiRelated: [
            { _id: nestedRelatedId1, title: "Nested Related Title 1" },
            { _id: nestedRelatedId2, title: "Nested Related Title 2" },
          ],
        },
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result).toBeInstanceOf(MockModelWithRelation);
      expect(result.get("name")).toBe("Test");
      expect(result.getData().nested.multiRelated).toEqual([nestedRelatedId1, nestedRelatedId2]);
      expect(adapterRelated.store.get(nestedRelatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterRelated.store.get(nestedRelatedId2)).toBeInstanceOf(RelatedModel);
      expect(result.nested?.multiRelated).toBeInstanceOf(PromiseModelList);
      expect(result.nested?.multiRelated?.cached).toBeInstanceOf(ModelList);
      expect(result.nested?.multiRelated?.cached?.length).toBe(2);
    });

    it("should handle nested array populated data with single relations", async () => {
      const nestedArrRelatedId1 = new ObjectId().toString();
      const nestedArrRelatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        nestedArr: [
          { related: { _id: nestedArrRelatedId1, title: "Nested Array Related Title 1" } },
          { related: { _id: nestedArrRelatedId2, title: "Nested Array Related Title 2" } },
        ],
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result).toBeInstanceOf(MockModelWithRelation);
      expect(result.get("name")).toBe("Test");
      expect(result.getData().nestedArr[0].related).toBe(nestedArrRelatedId1);
      expect(result.getData().nestedArr[1].related).toBe(nestedArrRelatedId2);
      expect(adapterRelated.store.get(nestedArrRelatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterRelated.store.get(nestedArrRelatedId2)).toBeInstanceOf(RelatedModel);
      expect(result.nestedArr?.[0]?.related).toBeInstanceOf(PromiseModel);
      expect(result.nestedArr?.[0]?.related?.cached).toBeInstanceOf(RelatedModel);
      expect(result.nestedArr?.[1]?.related).toBeInstanceOf(PromiseModel);
      expect(result.nestedArr?.[1]?.related?.cached).toBeInstanceOf(RelatedModel);
    });

    it("should handle mixed populated and unpopulated data", async () => {
      const relatedId1 = new ObjectId().toString();
      const relatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        related: { _id: relatedId1, title: "Populated Related" },
        multiRelated: [
          { _id: relatedId2, title: "Populated Multi Related" },
          relatedId1, // Already an ID, should remain unchanged
        ],
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result.getData().related).toBe(relatedId1);
      expect(result.getData().multiRelated).toEqual([relatedId2, relatedId1]);
      expect(adapterRelated.store.get(relatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterRelated.store.get(relatedId2)).toBeInstanceOf(RelatedModel);
    });

    it("should process deeply nested populated data", async () => {
      const relatedId1 = new ObjectId().toString();
      const relatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        nested: {
          related: { _id: relatedId1, title: "Nested Related" },
          multiRelated: [{ _id: relatedId2, title: "Nested Multi Related" }],
          circular: { _id: relatedId1, title: "Circular Reference" },
        },
        nestedArr: [
          {
            related: { _id: relatedId2, title: "Nested Array Related" },
            multiRelated: [{ _id: relatedId1, title: "Nested Array Multi Related" }],
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result.getData().nested.related).toBe(relatedId1);
      expect(result.getData().nested.multiRelated).toEqual([relatedId2]);
      expect(result.getData().nested.circular).toBe(relatedId1);
      expect(result.getData().nestedArr[0].related).toBe(relatedId2);
      expect(result.getData().nestedArr[0].multiRelated).toEqual([relatedId1]);
    });

    it("should handle multiple levels of nested populated data", async () => {
      const relatedId1 = new ObjectId().toString();
      const relatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        nested: {
          related: {
            _id: relatedId1,
            title: "Nested Related",
            other: {
              _id: relatedId2,
              title: "Nested Related 2",
            },
          },
        },
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result.getData().nested.related).toBe(relatedId1);

      expect(adapterRelated.store.get(relatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterOtherRelated.store.get(relatedId2)).toBeInstanceOf(OtherRelatedModel);

      expect(result.nested?.related).toBeInstanceOf(PromiseModel);
      expect(result.nested?.related?.cached).toBeInstanceOf(RelatedModel);
      expect(result.nested?.related?.cached?._id).toBe(relatedId1);

      expect(result.nested?.related?.cached?.other).toBeInstanceOf(PromiseModel);
      expect(result.nested?.related?.cached?.other?.cached).toBeInstanceOf(OtherRelatedModel);
      expect(result.nested?.related?.cached?.other?.cached?._id).toBe(relatedId2);
    });

    it("should handle multiple levels of nested populated data for multiple relations", async () => {
      const relatedId1 = new ObjectId().toString();
      const relatedId2 = new ObjectId().toString();
      const populatedData = {
        _id: "123",
        name: "Test",
        related: { _id: relatedId1, title: "Root Related" },
        multiRelated: [
          { _id: relatedId2, title: "Root Multi Related 1" },
          relatedId1, // Already an ID
        ],
        nested: {
          related: {
            _id: relatedId1,
            title: "Nested Related",
            other: {
              _id: relatedId2,
              title: "Nested Related 2",
            },
          },
          multiRelated: [{ _id: relatedId1, title: "Nested Multi Related" }],
        },
      };

      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: populatedData })));

      const result = await modelWithRelation.get("123");

      expect(result.getData().related).toBe(relatedId1);
      expect(result.getData().multiRelated).toEqual([relatedId2, relatedId1]);

      expect(adapterRelated.store.get(relatedId1)).toBeInstanceOf(RelatedModel);
      expect(adapterRelated.store.get(relatedId2)).toBeInstanceOf(RelatedModel);

      expect(result.related).toBeInstanceOf(PromiseModel);
      expect(result.related?.cached).toBeInstanceOf(RelatedModel);
      expect(result.related?.cached?._id).toBe(relatedId1);

      expect(result.multiRelated).toBeInstanceOf(PromiseModelList);
      expect(result.multiRelated?.cached).toBeInstanceOf(ModelList);
      expect(result.multiRelated?.cached?.length).toBe(2);
      expect(result.multiRelated?.cached?.[0]).toBeInstanceOf(RelatedModel);
      expect(result.multiRelated?.cached?.[1]).toBeInstanceOf(RelatedModel);
      expect(result.multiRelated?.cached?.[0]?._id).toBe(relatedId2);
      expect(result.multiRelated?.cached?.[1]?._id).toBe(relatedId1);
    });

    it("should correctly handle and cache deeply nested relations across multiple dynamic models", async () => {
      const dmOtherRelated = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-3",
        definition: {
          keyField: "title",
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });
      const dmRelated = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-2",
        definition: {
          keyField: "title",
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
            otherRelated: {
              type: FieldTypes.RELATION,
              options: {
                ref: dmOtherRelated.slug,
              },
            },
          },
        },
      });
      const dm = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-1",
        definition: {
          keyField: "title",
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
            related: {
              type: FieldTypes.RELATION,
              options: {
                ref: dmRelated.slug,
              },
            },
          },
        },
      });

      fetchMock.mockImplementation(async (args: any) => {
        // Mock datamodels query
        if (args.url.includes("datamodels/")) {
          const slug = args.url.split("/").pop();
          const found = [dmRelated, dm].find(d => d.slug === slug);
          return new Response(JSON.stringify({ data: found?.toJSON() }));
        }

        return new Response(
          JSON.stringify({
            data: {
              _id: id1,
              title: faker.random.alphaNumeric(10),
              related: {
                _id: id2,
                title: faker.random.alphaNumeric(10),
                otherRelated: {
                  _id: id3,
                  title: faker.random.alphaNumeric(10),
                },
              },
            },
          }),
        );
      });

      const id1 = new ObjectId().toString();
      const id2 = new ObjectId().toString();
      const id3 = new ObjectId().toString();

      await client.getModel(dm.slug as string).get(id1);

      const adapter1 = client.getModel(dm.slug as string).getAdapter() as unknown as ClientAdapter;
      const adapter2 = client.getModel(dmRelated.slug as string).getAdapter() as unknown as ClientAdapter;
      const adapter3 = client.getModel(dmOtherRelated.slug as string).getAdapter() as unknown as ClientAdapter;

      expect(adapter1.store.has(id1)).toBeTruthy();
      expect(adapter2.store.has(id2)).toBeTruthy();
      expect(adapter3.store.has(id3)).toBeTruthy();
    });

    it("should handle circular references in dynamic models", async () => {
      const slug = faker.random.alphaNumeric(10) + "-circular";

      const id1 = new ObjectId().toString();
      const id2 = new ObjectId().toString();

      fetchMock.mockImplementation(async (args: any) => {
        if (args.url.includes("datamodels/")) {
          return new Response(
            JSON.stringify({
              data: {
                _id: new ObjectId().toString(),
                slug,
                definition: {
                  keyField: "title",
                  fields: {
                    title: { type: FieldTypes.TEXT },
                    selfRef: {
                      type: FieldTypes.RELATION,
                      options: { ref: slug },
                    },
                  },
                },
              },
            }),
          );
        }

        return new Response(
          JSON.stringify({
            data: {
              _id: id1,
              title: faker.random.alphaNumeric(10),
              selfRef: {
                _id: id2,
                title: faker.random.alphaNumeric(10),
                selfRef: id1, // Circular reference
              },
            },
          }),
        );
      });

      const model = client.getModel<
        typeof Model & {
          definition: {
            fields: {
              title: { type: FieldTypes.TEXT };
              selfRef: {
                type: FieldTypes.RELATION;
              };
            };
          };
        }
      >(slug);
      await model.get(id1);
      const adapter = model.getAdapter() as unknown as ClientAdapter;

      expect(adapter.store.has(id1)).toBeTruthy();
      expect(adapter.store.has(id2)).toBeTruthy();

      const instance1 = model.get(id1).cached;
      const instance2 = model.get(id2).cached;

      expect(instance1?.selfRef?.cached).toBe(instance2);
      expect(instance2?.selfRef?.cached).toBe(instance1);
    });

    it("should correctly populate nested arrays with relations", async () => {
      const slug = faker.random.alphaNumeric(10) + "-nested";
      const dmNested = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug,
        definition: {
          keyField: "title",
          fields: {
            title: { type: FieldTypes.TEXT },
            items: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.NESTED,
                  options: {
                    fields: {
                      name: { type: FieldTypes.TEXT },
                      subItem: {
                        type: FieldTypes.RELATION,
                        options: { ref: slug },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const id1 = new ObjectId().toString();
      const id2 = new ObjectId().toString();
      const id3 = new ObjectId().toString();

      fetchMock.mockImplementation(async (args: any) => {
        if (args.url.includes("datamodels/")) {
          return new Response(JSON.stringify({ data: dmNested.toJSON() }));
        }

        return new Response(
          JSON.stringify({
            data: {
              _id: id1,
              title: faker.random.alphaNumeric(10),
              items: [
                {
                  name: faker.random.alphaNumeric(10),
                  subItem: {
                    _id: id2,
                    title: faker.random.alphaNumeric(10),
                  },
                },
                {
                  name: faker.random.alphaNumeric(10),
                  subItem: {
                    _id: id3,
                    title: faker.random.alphaNumeric(10),
                  },
                },
              ],
            },
          }),
        );
      });

      await client.getModel(dmNested.slug as string).get(id1);
      const adapter = client.getModel(dmNested.slug as string).getAdapter() as unknown as ClientAdapter;

      expect(adapter.store.has(id1)).toBeTruthy();
      expect(adapter.store.has(id2)).toBeTruthy();
      expect(adapter.store.has(id3)).toBeTruthy();
      const instance = adapter.store.get(id1) as ModelInstance<
        typeof Model & {
          definition: {
            fields: {
              items: {
                type: FieldTypes.ARRAY;
                options: {
                  items: { type: FieldTypes.NESTED; options: { fields: { subItem: { type: FieldTypes.RELATION } } } };
                };
              };
            };
          };
        }
      >;
      expect(instance?.items?.[0]?.subItem?.cached).toBe(adapter.store.get(id2));
      expect(instance?.items?.[1]?.subItem?.cached).toBe(adapter.store.get(id3));
    });

    it("should update cache when deeply nested relations are modified", async () => {
      const dmDeep2 = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-deep-2",
        definition: {
          keyField: "title",
          fields: {
            title: { type: FieldTypes.TEXT },
          },
        },
      });

      const dmDeep1 = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-deep-1",
        definition: {
          keyField: "title",
          fields: {
            title: { type: FieldTypes.TEXT },
            level2: {
              type: FieldTypes.RELATION,
              options: { ref: dmDeep2.slug },
            },
          },
        },
      });

      const dmDeep = client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10) + "-deep",
        definition: {
          keyField: "title",
          fields: {
            title: { type: FieldTypes.TEXT },
            level1: {
              type: FieldTypes.RELATION,
              options: { ref: dmDeep1.slug },
            },
          },
        },
      });

      const id1 = new ObjectId().toString();
      const id2 = new ObjectId().toString();
      const id3 = new ObjectId().toString();
      const id4 = new ObjectId().toString();

      let updateCount = 0;
      fetchMock.mockImplementation(async (args: any) => {
        if (args.url.includes("datamodels/")) {
          const slug = args.url.split("/").pop();
          const found = [dmDeep, dmDeep1, dmDeep2].find(d => d.slug === slug);
          return new Response(JSON.stringify({ data: found?.toJSON() }));
        }

        updateCount++;

        return new Response(
          JSON.stringify({
            data: {
              _id: id1,
              title: faker.random.alphaNumeric(10),
              _updatedAt: new Date(Date.now() + updateCount).toJSON(),
              level1: {
                _id: id2,
                title: faker.random.alphaNumeric(10),
                _updatedAt: new Date(Date.now() + updateCount).toJSON(),
                level2: {
                  _id: updateCount === 1 ? id3 : id4,
                  title: faker.random.alphaNumeric(10),
                  _updatedAt: new Date(Date.now() + updateCount).toJSON(),
                },
              },
            },
          }),
        );
      });

      await client.getModel(dmDeep.slug as string).get(id1);
      const adapter = client.getModel(dmDeep.slug as string).getAdapter() as unknown as ClientAdapter;
      const adapter1 = client.getModel(dmDeep1.slug as string).getAdapter() as unknown as ClientAdapter;
      const adapter2 = client.getModel(dmDeep2.slug as string).getAdapter() as unknown as ClientAdapter;

      expect(adapter.store.has(id1)).toBeTruthy();
      expect(adapter1.store.has(id2)).toBeTruthy();
      expect(adapter2.store.has(id3)).toBeTruthy();

      // Update the deeply nested relation
      await client.getModel(dmDeep.slug as string).get(id1, { disableCache: true });

      expect(updateCount).toBe(2);

      expect(adapter.store.has(id1)).toBeTruthy();
      expect(adapter1.store.has(id2)).toBeTruthy();
      expect(adapter2.store.has(id4)).toBeTruthy();

      const instance = adapter.store.get(id1) as any;
      expect(instance?.level1.cached?.level2.cached?._id).toBe(id4);
    });
  });

  describe("disableCache option", () => {
    let clientWithDisabledCache: Client;
    let modelWithDisabledCache: typeof MockModel;
    let adapterWithDisabledCache: ClientAdapter;

    beforeEach(() => {
      clientWithDisabledCache = new Client([], {
        accessToken: "...",
        project: null,
        disableCache: true,
      });
      modelWithDisabledCache = clientWithDisabledCache.getModel(MockModel);
      adapterWithDisabledCache = modelWithDisabledCache.getAdapter() as unknown as ClientAdapter;
      vi.spyOn(global, "fetch");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should not use cache when fetching a single model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithDisabledCache.get("123");
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithDisabledCache.get("123");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should not use cache when fetching a list of models", async () => {
      const data = '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}';
      fetchMock.mockResolvedValueOnce(new Response(data));
      await modelWithDisabledCache.getList();
      fetchMock.mockResolvedValueOnce(new Response(data));
      await modelWithDisabledCache.getList();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should update store after creating a model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
      await modelWithDisabledCache.create({ name: "NewTest" });
      expect(adapterWithDisabledCache.store.size).toBe(1);
      expect(adapterWithDisabledCache.store.get("123")?.get("name")).toBe("NewTest");
    });

    it("should update store after updating a model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
      await modelWithDisabledCache.update("123", { $set: { name: "UpdatedTest" } });
      expect(adapterWithDisabledCache.store.size).toBe(1);
      expect(adapterWithDisabledCache.store.get("123")?.get("name")).toBe("UpdatedTest");
    });

    it("should not use cache for specific models when disableCache is an array", async () => {
      const clientWithSelectiveCache = new Client([], {
        accessToken: "...",
        project: null,
        disableCache: ["mockModel"],
      });
      const modelWithSelectiveCache = clientWithSelectiveCache.getModel(MockModel);
      const adapterWithSelectiveCache = modelWithSelectiveCache.getAdapter() as unknown as ClientAdapter;

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithSelectiveCache.get("123");
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithSelectiveCache.get("123");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(adapterWithSelectiveCache.store.size).toBe(1);
    });
  });

  describe("disableStore option", () => {
    let clientWithDisabledStore: Client;
    let modelWithDisabledStore: typeof MockModel;
    let adapterWithDisabledStore: ClientAdapter;

    beforeEach(() => {
      clientWithDisabledStore = new Client([], {
        accessToken: "...",
        project: null,
        disableStore: true,
      });
      modelWithDisabledStore = clientWithDisabledStore.getModel(MockModel);
      adapterWithDisabledStore = modelWithDisabledStore.getAdapter() as unknown as ClientAdapter;
      vi.spyOn(global, "fetch");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should not store instances in memory when fetching a single model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithDisabledStore.get("123");
      expect(adapterWithDisabledStore.store.size).toBe(0);
    });

    it("should not store instances in memory when fetching a list of models", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await modelWithDisabledStore.getList();
      expect(adapterWithDisabledStore.store.size).toBe(0);
    });

    it("should not store instances in memory after creating a model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "NewTest"}}'));
      await modelWithDisabledStore.create({ name: "NewTest" });
      expect(adapterWithDisabledStore.store.size).toBe(0);
    });

    it("should not store instances in memory after updating a model", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
      await modelWithDisabledStore.update("123", { $set: { name: "UpdatedTest" } });
      expect(adapterWithDisabledStore.store.size).toBe(0);
    });

    it("should not store instances for specific models when disableStore is an array", async () => {
      const clientWithSelectiveStore = new Client([], {
        accessToken: "...",
        project: null,
        disableStore: ["mockModel"],
      });
      const modelWithSelectiveStore = clientWithSelectiveStore.getModel(MockModel);
      const adapterWithSelectiveStore = modelWithSelectiveStore.getAdapter() as unknown as ClientAdapter;

      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithSelectiveStore.get("123");
      expect(adapterWithSelectiveStore.store.size).toBe(0);
    });
  });

  describe("Accept header", () => {
    let modelWithAcceptHeader: typeof MockModel;

    beforeEach(() => {
      modelWithAcceptHeader = client.getModel(MockModel);
    });

    it("should be set to application/json on createOne", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithAcceptHeader.create({ name: "Test" });
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });

    it("should be set to application/json on createMultiple", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('{"data": [{"_id": "123", "name": "Test"}, {"_id": "456", "name": "Test2"}] }'),
      );
      await modelWithAcceptHeader.createMultiple([{ name: "Test" }, { name: "Test2" }]);
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });

    it("should be set to application/json on updateOne", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "UpdatedTest"}}'));
      await modelWithAcceptHeader.update("123", { $set: { name: "UpdatedTest" } });
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });

    it("should be set to application/json on deleteOne", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123"}}'));
      await modelWithAcceptHeader.delete("123");
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });

    it("should be set to application/json on get", async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"data": {"_id": "123", "name": "Test"}}'));
      await modelWithAcceptHeader.get("123");
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });

    it("should be set to application/json on getList", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          '{"data": {"rows": [{"_id": "123", "name": "Test1"}, {"_id": "456", "name": "Test2"}], "count": 2}}',
        ),
      );
      await modelWithAcceptHeader.getList();
      // @ts-expect-error - headers is not defined on the request object
      expect(fetchMock.mock.calls[0][0].headers.get("Accept")).toBe("application/json");
    });
  });
});
