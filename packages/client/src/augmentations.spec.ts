import { vi } from "vitest";
import { ObjectId } from "bson";
import { ModelUpdaterEvent } from "@/types.js";
import {
  FieldTypes,
  Model,
  ModelCrudEvent,
  modelDecorator,
  ModelDefinition,
  ModelInstance,
  ModelList,
  PromiseModel,
  PromiseModelList,
} from "@graphand/core";
import { Client } from "./lib/Client.js";
import { ClientAdapter } from "./lib/ClientAdapter.js";

describe("augmentations", () => {
  @modelDecorator()
  class TestModel extends Model {
    static slug = "testModel";
    static definition = {
      fields: {
        someField: {
          type: FieldTypes.TEXT,
        },
      },
    };
  }

  let client: Client;
  let model: typeof TestModel;
  let adapter: ClientAdapter;
  const mockFetch = vi.spyOn(global, "fetch");

  beforeEach(() => {
    client = new Client([], { accessToken: "test-token", project: "test-project" });
    model = client.getModel(TestModel);
    adapter = model.getAdapter() as unknown as ClientAdapter;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    mockFetch.mockRestore();
  });

  describe("Model.subscribe", () => {
    it("should return a function when subscribed", () => {
      const unsubscribe = model.subscribe(() => {});
      expect(typeof unsubscribe).toBe("function");
    });

    it("should call the observer when an event is dispatched", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should not call the observer after unsubscribing", () => {
      const observer = vi.fn();
      const unsubscribe = model.subscribe(observer);

      unsubscribe();

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should allow multiple subscriptions", () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();

      model.subscribe(observer1);
      model.subscribe(observer2);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer1).toHaveBeenCalled();
      expect(observer2).toHaveBeenCalled();
      expect(observer1.mock.calls?.[0]?.[0]).toEqual(event);
      expect(observer2.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should handle create events", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should handle update events", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should handle delete events", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      adapter.store.set("123", model.hydrate({ _id: "123" }));
      const event: ModelUpdaterEvent = { operation: "delete", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should not call the observer for events from other models", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      class OtherModel extends Model {
        static slug = "otherModel";
      }

      const adapter2 = client.getModel(OtherModel).getAdapter() as unknown as ClientAdapter;

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter2.dispatch({ ...event, model: "otherModel", data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should work with async observers", async () => {
      const asyncObserver = vi.fn().mockImplementation(() => Promise.resolve());
      model.subscribe(asyncObserver);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(asyncObserver).toHaveBeenCalled();
      expect(asyncObserver.mock.calls?.[0]?.[0]).toEqual(event);
    });

    it("should not call the observer for events with empty ids", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: [] };
      adapter.dispatch({ ...event, model: model.slug, data: [] } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle multiple events in quick succession", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      const events: ModelUpdaterEvent[] = [
        { operation: "create", ids: ["1"] },
        { operation: "update", ids: ["1"] },
        { operation: "delete", ids: ["1"] },
      ];

      events.forEach((event, i) => {
        adapter.dispatch({
          ...event,
          model: model.slug,
          data:
            event.operation === "delete"
              ? null
              : [{ _id: event.ids[0], _updatedAt: new Date(Date.now() + i + 1).toJSON() }],
        } as ModelCrudEvent<any, typeof model>);
      });

      expect(observer).toHaveBeenCalledTimes(3);
      expect(observer.mock.calls?.[0]?.[0]).toEqual(events[0]);
      expect(observer.mock.calls?.[1]?.[0]).toEqual(events[1]);
      expect(observer.mock.calls?.[2]?.[0]).toEqual(events[2]);
    });

    it("should handle subscription immediately after model creation", () => {
      @modelDecorator()
      class NewModel extends Model {
        static slug = "newModel";
      }
      const newModel = client.getModel(NewModel);
      const newAdapter = newModel.getAdapter() as unknown as ClientAdapter;

      const observer = vi.fn();
      const unsubscribe = newModel.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      newAdapter.dispatch({ ...event, model: newModel.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should handle a large number of subscriptions", () => {
      const observers = Array.from({ length: 1000 }, () => vi.fn());
      observers.forEach(observer => model.subscribe(observer));

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      observers.forEach(observer => {
        expect(observer.mock.calls?.[0]?.[0]).toEqual(event);
      });
    });

    it("should maintain separate subscriptions for different models", () => {
      @modelDecorator()
      class OtherModel extends Model {
        static slug = "otherModel";
      }
      const otherModel = client.getModel(OtherModel);
      const otherAdapter = otherModel.getAdapter() as unknown as ClientAdapter;

      const observer1 = vi.fn();
      const observer2 = vi.fn();

      model.subscribe(observer1);
      otherModel.subscribe(observer2);

      const event1: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      const event2: ModelUpdaterEvent = { operation: "create", ids: ["456"] };

      adapter.dispatch({ ...event1, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);
      otherAdapter.dispatch({ ...event2, model: otherModel.slug, data: [{ _id: "456" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer1).toHaveBeenCalledWith(event1, undefined);
      expect(observer1).not.toHaveBeenCalledWith(event2, undefined);
      expect(observer2).toHaveBeenCalledWith(event2, undefined);
      expect(observer2).not.toHaveBeenCalledWith(event1, undefined);
    });

    it("should handle subscriptions when model is cleared from cache", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      model.clearCache();

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalledWith(event, undefined);
    });

    it("should not interfere with other Model static methods", () => {
      const observer = vi.fn();
      model.subscribe(observer);

      expect(typeof model.getClient).toBe("function");
      expect(model.getClient()).toBeInstanceOf(Client);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalledWith(event, undefined);
    });

    it("should work correctly with inherited model classes", () => {
      class ExtendedModel extends TestModel {
        static slug = "extendedModel";
      }

      const extendedModel = client.getModel(ExtendedModel);
      const extendedAdapter = extendedModel.getAdapter() as unknown as ClientAdapter;

      const observer = vi.fn();
      extendedModel.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      extendedAdapter.dispatch({ ...event, model: extendedModel.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalledWith(event, undefined);
    });
  });

  describe("Model.clearCache", () => {
    it("should clear all instances from the cache", () => {
      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      const instance2 = TestModel.hydrate({ _id: "2", someField: "value2" });
      adapter.store.set("1", instance1);
      adapter.store.set("2", instance2);

      expect(adapter.store.size).toBe(2);

      model.clearCache();

      expect(adapter.store.size).toBe(0);
    });

    it("should return the model class", () => {
      const result = model.clearCache();
      expect(result).toBe(model);
    });

    it("should not affect other model caches", () => {
      class OtherModel extends Model {
        static slug = "otherModel";
      }
      const otherModel = client.getModel(OtherModel);
      const otherAdapter = otherModel.getAdapter() as unknown as ClientAdapter;

      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      // @ts-expect-error
      const instance2 = OtherModel.hydrate({ _id: "2", someField: "value2" });
      adapter.store.set("1", instance1);
      otherAdapter.store.set("2", instance2);

      model.clearCache();

      expect(adapter.store.size).toBe(0);
      expect(otherAdapter.store.size).toBe(1);
    });

    it("should work with an empty cache", () => {
      expect(adapter.store.size).toBe(0);
      model.clearCache();
      expect(adapter.store.size).toBe(0);
    });

    it("should clear cache for inherited model classes", () => {
      class ExtendedModel extends TestModel {
        static slug = "extendedModel";
      }
      const extendedModel = client.getModel(ExtendedModel);
      const extendedAdapter = extendedModel.getAdapter() as unknown as ClientAdapter;

      const instance = ExtendedModel.hydrate({ _id: "1", someField: "value" });
      extendedAdapter.store.set("1", instance);

      expect(extendedAdapter.store.size).toBe(1);
      extendedModel.clearCache();
      expect(extendedAdapter.store.size).toBe(0);
    });

    it("should allow adding new instances after clearing the cache", () => {
      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      adapter.store.set("1", instance1);

      model.clearCache();

      const instance2 = TestModel.hydrate({ _id: "2", someField: "value2" });
      adapter.store.set("2", instance2);

      expect(adapter.store.size).toBe(1);
      expect(adapter.store.get("2")).toBe(instance2);
    });

    it("should not interfere with model's ability to create new instances", () => {
      model.clearCache();

      const newInstance = TestModel.hydrate({ _id: "1", someField: "value" });
      expect(newInstance).toBeInstanceOf(TestModel);
      expect(newInstance.get("_id")).toBe("1");
    });

    it("should clear cache multiple times without errors", () => {
      const instance = TestModel.hydrate({ _id: "1", someField: "value" });
      adapter.store.set("1", instance);

      model.clearCache();
      expect(adapter.store.size).toBe(0);

      model.clearCache();
      expect(adapter.store.size).toBe(0);

      model.clearCache();
      expect(adapter.store.size).toBe(0);
    });

    it("should work correctly when called in combination with other methods", async () => {
      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      adapter.store.set("1", instance1);

      mockFetch.mockResolvedValue(new Response('{"data": {"_id": "1", "someField": "updated"}}', { status: 200 }));

      model.clearCache();

      const refetchedInstance = await model.get("1");

      expect(mockFetch).toHaveBeenCalled();
      expect(refetchedInstance?.get("someField")).toBe("updated");
      expect(adapter.store.size).toBe(1);
    });
  });

  describe("Model.getClient", () => {
    it("should return the Client instance associated with the model", () => {
      const returnedClient = model.getClient();
      expect(returnedClient).toBe(client);
      expect(returnedClient).toBeInstanceOf(Client);
    });

    it("should return the same Client instance for different models from the same client", () => {
      class AnotherModel extends Model {
        static slug = "anotherModel";
      }
      const anotherModel = client.getModel(AnotherModel);

      const client1 = model.getClient();
      const client2 = anotherModel.getClient();

      expect(client1).toBe(client2);
      expect(client1).toBe(client);
    });

    it("should throw an error if called on a model not associated with a client", () => {
      class UnassociatedModel extends Model {
        static slug = "unassociatedModel";
      }

      expect(() => UnassociatedModel.getClient()).toThrow();
    });
  });

  describe("Model.prototype.subscribe", () => {
    let instance: ModelInstance<typeof model>;

    beforeEach(() => {
      instance = model.hydrate({ _id: "test-id" });
    });

    it("should return a function when subscribed", () => {
      const unsubscribe = instance.subscribe(() => {});
      expect(typeof unsubscribe).toBe("function");
    });

    it("should call the observer when the instance is updated", () => {
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["test-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "test-id", someField: "test123", _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer when a different instance is updated", () => {
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["other-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "other-id", someField: "test123" }] } as any);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should call the observer when the instance is deleted", () => {
      const observer = vi.fn();
      instance.subscribe(observer);
      adapter.store.set(instance._id as string, instance);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["test-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer after unsubscribing", () => {
      const observer = vi.fn();
      const unsubscribe = instance.subscribe(observer);

      unsubscribe();

      const event: ModelUpdaterEvent = { operation: "update", ids: ["test-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "test-id", someField: "test123" }],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle multiple subscriptions on the same instance", () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();

      instance.subscribe(observer1);
      instance.subscribe(observer2);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["test-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "test-id", someField: "test123" }],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer1).toHaveBeenCalled();
      expect(observer2).toHaveBeenCalled();
    });

    it("should handle updateMultiple events that include the instance", () => {
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["test-id", "other-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [
          { _id: "test-id", someField: "test123" },
          { _id: "other-id", someField: "test123" },
        ],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer for updateMultiple events that don't include the instance", () => {
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["other-id-1", "other-id-2"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [
          { _id: "other-id-1", someField: "test123" },
          { _id: "other-id-2", someField: "test123" },
        ],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle deleteMultiple events that include the instance", () => {
      const observer = vi.fn();
      instance.subscribe(observer);
      adapter.store.set(instance._id as string, instance);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["test-id", "other-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer for deleteMultiple events that don't include the instance", () => {
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["other-id-1", "other-id-2"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle create events (even though they shouldn't affect an existing instance)", () => {
      adapter.store.set("test-id", instance);
      const observer = vi.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["test-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "test-id", someField: "test123" }],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should work with async observers", async () => {
      const asyncObserver = vi.fn().mockImplementation(() => Promise.resolve());
      instance.subscribe(asyncObserver);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["test-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "test-id", someField: "test123" }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(asyncObserver).toHaveBeenCalled();
    });

    it("should allow subscribing to a newly created instance", () => {
      const newInstance = model.hydrate({ _id: "new-id" });
      const observer = vi.fn();
      newInstance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["new-id"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "new-id", someField: "test123" }],
      } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should pass the previous data and event to the observer", async () => {
      const body1 = JSON.stringify({ data: { _id: "test-id", someField: "test123" } });
      mockFetch.mockResolvedValueOnce(new Response(body1));

      const i = await model.get("test-id");
      expect(i.someField).toBe("test123");

      const observer = vi.fn();
      i.subscribe(observer);

      const body2 = JSON.stringify({
        data: { _id: "test-id", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() },
      });
      mockFetch.mockResolvedValueOnce(new Response(body2));
      await i.update({ $set: { someField: "updated" } });
      expect(i.someField).toBe("updated");

      expect(observer).toHaveBeenCalledWith(
        { _id: "test-id", someField: "test123" },
        { operation: "update", ids: ["test-id"] },
      );

      const body3 = JSON.stringify({
        data: { _id: "test-id", someField: "updated2", _updatedAt: new Date(Date.now() + 20).toJSON() },
      });
      mockFetch.mockResolvedValueOnce(new Response(body3));
      await i.update({ $set: { someField: "updated2" } });
      expect(i.someField).toBe("updated2");

      expect(observer).toHaveBeenCalledWith(
        { _id: "test-id", someField: "updated", _updatedAt: expect.any(String) },
        { operation: "update", ids: ["test-id"] },
      );
    });

    it("should handle multiple updates in rapid succession", async () => {
      const observer = vi.fn();
      instance.subscribe(observer);
      adapter.store.set("test-id", instance);

      const updateEvents = [{ someField: "update1" }, { someField: "update2" }, { someField: "update3" }];

      const mockFetch = vi.spyOn(global, "fetch");

      let i = 0;
      for (const update of updateEvents) {
        const body = JSON.stringify({
          data: { ...instance.getData(), ...update, _updatedAt: new Date(Date.now() + i + 1).toJSON() },
        });
        mockFetch.mockResolvedValueOnce(new Response(body));
        await instance.update({ $set: update });
        i++;
      }

      expect(observer).toHaveBeenCalledTimes(3);

      expect(observer.mock.calls?.[0]?.[0]).toEqual({ _id: "test-id" });
      expect(observer.mock.calls?.[0]?.[1]).toEqual({ operation: "update", ids: ["test-id"] });
      expect(observer.mock.calls?.[1]?.[0]).toHaveProperty("someField", "update1");
      expect(observer.mock.calls?.[1]?.[1]).toEqual({ operation: "update", ids: ["test-id"] });
      expect(observer.mock.calls?.[2]?.[0]).toHaveProperty("someField", "update2");
      expect(observer.mock.calls?.[2]?.[1]).toEqual({ operation: "update", ids: ["test-id"] });

      expect(instance.getData()).toHaveProperty("someField", "update3");
    });
  });

  describe("ModelList.prototype.subscribe", () => {
    let modelList: ModelList<typeof TestModel>;

    beforeEach(() => {
      const i1 = model.hydrate({
        _id: "1",
        someField: "value1",
        _createdAt: new Date().toJSON(),
        _updatedAt: new Date().toJSON(),
      });
      const i2 = model.hydrate({
        _id: "2",
        someField: "value2",
        _createdAt: new Date().toJSON(),
        _updatedAt: new Date().toJSON(),
      });
      adapter.store.set("1", i1);
      adapter.store.set("2", i2);
      modelList = new ModelList(model, [i1, i2]);
    });

    beforeAll(() => {
      vi.restoreAllMocks();
    });

    // Test 1: Unsubscribe functionality
    it("should stop calling the observer after unsubscribing", async () => {
      const observer = vi.fn();
      const unsubscribe = modelList.subscribe(observer);

      // This line is needed because the list is reloaded when an element is updated within the list and the server is not accessible in tests
      // So we need to mock the server response to prevent the list update process from being interrupted
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: modelList.toJSON() })));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledTimes(1);

      unsubscribe();

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["2"],
        data: [{ _id: "2", someField: "updated", _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledTimes(1);
    });

    // Test 2: Loading state changes
    it("should call onLoadingChange with correct loading states", async () => {
      const observer = vi.fn();
      const onLoadingChange = vi.fn();
      modelList.subscribe(observer, { onLoadingChange });

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: modelList.toJSON() })));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onLoadingChange).toHaveBeenCalledTimes(2);
      expect(onLoadingChange).toHaveBeenNthCalledWith(1, true);
      expect(onLoadingChange).toHaveBeenNthCalledWith(2, false);
      expect(observer).toHaveBeenCalledTimes(1);
    });

    // Test 3: Multiple subscriptions
    it("should handle multiple subscriptions independently", async () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();
      modelList.subscribe(observer1);
      modelList.subscribe(observer2);

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: modelList.toJSON() })));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer1).toHaveBeenCalledTimes(1);
      expect(observer2).toHaveBeenCalledTimes(1);
    });

    // Test 4: Error handling during reload
    it("should handle errors during reload and call onLoadingChange", async () => {
      const body = JSON.stringify({ data: modelList.toJSON() });
      mockFetch.mockResolvedValueOnce(new Response(body));
      await model.initialize();
      const _modelList = await model.getList();

      const observer = vi.fn();
      const onLoadingChange = vi.fn();
      const onError = vi.fn();
      _modelList.subscribe(observer, { onLoadingChange, onError });

      mockFetch.mockRejectedValueOnce(new Error("Reload failed"));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(onLoadingChange).toHaveBeenCalledTimes(2);
      expect(onLoadingChange).toHaveBeenNthCalledWith(1, true);
      expect(onLoadingChange).toHaveBeenNthCalledWith(2, false);
      expect(observer).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(new Error("Reload failed"));
    });

    // Test 5: No changes in list
    it("should not call the observer if the list hasn't changed after reload", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer);

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: modelList.toJSON() })));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["3"], // ID not in the list
        data: [{ _id: "3", someField: "new", _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer).not.toHaveBeenCalled();
    });

    // Test 6: Create operation
    it("should call the observer when a new item is created and added to the list", async () => {
      const body = JSON.stringify({ data: modelList.toJSON() });
      mockFetch.mockResolvedValueOnce(new Response(body));
      const _modelList = await model.getList();

      const observer = vi.fn();
      _modelList.subscribe(observer);

      const updatedList = [
        ...modelList.toJSON().rows,
        { _id: "3", someField: "new", _createdAt: new Date().toJSON(), _updatedAt: new Date().toJSON() },
      ];
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: updatedList, count: updatedList.length } })),
      );

      adapter.dispatch({
        operation: "create",
        model: model.slug,
        ids: ["3"],
        data: [{ _id: "3", someField: "new", _createdAt: new Date().toJSON(), _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer).toHaveBeenCalledWith({ operation: "create", ids: ["3"] });
    });

    // Test 7: Delete operation
    it("should call the observer when an item is deleted from the list", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer);

      const updatedList = modelList.toJSON().rows.filter(item => item._id !== "2");
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: updatedList, count: updatedList.length } })),
      );

      adapter.dispatch({
        operation: "delete",
        model: model.slug,
        ids: ["2"],
        data: null,
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer).toHaveBeenCalledWith({ operation: "delete", ids: ["2"] });
    });

    // Test 8: Batch updates
    it("should handle batch updates correctly", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer);

      const updatedList = modelList.toJSON().rows.map(item => ({
        ...item,
        someField: item._id === "1" ? "updated1" : "updated2",
        _updatedAt: new Date(Date.now() + 10).toJSON(),
      }));
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: updatedList, count: updatedList.length } })),
      );

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1", "2"],
        data: [
          { _id: "1", someField: "updated1", _updatedAt: new Date(Date.now() + 10).toJSON() },
          { _id: "2", someField: "updated2", _updatedAt: new Date(Date.now() + 10).toJSON() },
        ],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1", "2"] });
      expect(observer).toHaveBeenCalledTimes(1);
    });

    // Test 9: Reordering of list
    it("should call the observer when the list order changes", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer);

      const reorderedList = modelList.toJSON().rows.slice().reverse();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: reorderedList, count: reorderedList.length } })),
      );

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1", "2"],
        data: [
          { _id: "1", someField: "value1", _updatedAt: new Date(Date.now() + 10).toJSON() },
          { _id: "2", someField: "value2", _updatedAt: new Date(Date.now() + 10).toJSON() },
        ],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1", "2"] });
    });

    // Test 10: Performance with large lists
    it("should handle large lists efficiently", async () => {
      const largeList = new ModelList(
        model,
        Array.from({ length: 1000 }, (_, i) =>
          model.hydrate({
            _id: `${i}`,
            someField: `value${i}`,
            _createdAt: new Date().toJSON(),
            _updatedAt: new Date().toJSON(),
          }),
        ),
      );

      const observer = vi.fn();
      const onLoadingChange = vi.fn();
      largeList.subscribe(observer, { onLoadingChange });

      const updatedList = largeList
        .toJSON()
        .rows.map(item =>
          item._id === "500" ? { ...item, someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() } : item,
        );
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { rows: updatedList, count: updatedList.length } })),
      );

      const startTime = performance.now();

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["500"],
        data: [{ _id: "500", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["500"] });
      expect(executionTime).toBeLessThan(150); // Assuming less than 150ms is acceptable
    });

    // Test 11: Basic subscription with noReload option
    it("should call the observer when an item in the list is updated with noReload option", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer, { noReload: true });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // Test 12: Subscription should not trigger for items not in the list
    it("should not call the observer for updates to items not in the list with noReload option", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer, { noReload: true });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["3"],
        data: [{ _id: "3", someField: "new", _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).not.toHaveBeenCalled();
    });

    // Test 13: Handling create operations with noReload
    it("should not call the observer for create operations with noReload option", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer, { noReload: true });

      adapter.dispatch({
        operation: "create",
        model: model.slug,
        ids: ["3"],
        data: [{ _id: "3", someField: "new", _createdAt: new Date().toJSON(), _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).not.toHaveBeenCalled();
    });

    // Test 14: Handling delete operations with noReload
    it("should call the observer for delete operations of items in the list with noReload option", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer, { noReload: true, autoRemove: true });

      adapter.dispatch({
        operation: "delete",
        model: model.slug,
        ids: ["1"],
        data: null,
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledWith({ operation: "delete", ids: ["1"] });
    });

    // Test 15: Multiple subscriptions with noReload
    it("should handle multiple subscriptions independently with noReload option", async () => {
      const observer1 = vi.fn();
      const observer2 = vi.fn();
      modelList.subscribe(observer1, { noReload: true });
      modelList.subscribe(observer2, { noReload: true });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer1).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
      expect(observer2).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
    });

    // Test 16: Unsubscribe functionality with noReload
    it("should stop calling the observer after unsubscribing with noReload option", async () => {
      const observer = vi.fn();
      const unsubscribe = modelList.subscribe(observer, { noReload: true });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledTimes(1);

      unsubscribe();

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["2"],
        data: [{ _id: "2", someField: "updated", _updatedAt: new Date(Date.now() + 20).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledTimes(1);
    });

    // Test 17: Subscription behavior without noReload option
    it("should reload the list when an update occurs without noReload option", async () => {
      const observer = vi.fn();
      const reloadSpy = vi.spyOn(modelList, "reload").mockResolvedValue();
      modelList.subscribe(observer);

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(reloadSpy).toHaveBeenCalled();
      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
    });

    // Test 18: onLoadingChange callback
    it("should call onLoadingChange with correct loading states", async () => {
      const observer = vi.fn();
      const onLoadingChange = vi.fn();
      const reloadSpy = vi.spyOn(modelList, "reload").mockResolvedValue();
      modelList.subscribe(observer, { onLoadingChange });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(onLoadingChange).toHaveBeenCalledTimes(2);
      expect(onLoadingChange).toHaveBeenNthCalledWith(1, true);
      expect(onLoadingChange).toHaveBeenNthCalledWith(2, false);
      expect(reloadSpy).toHaveBeenCalled();
      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
    });

    // Test 19: onError callback
    it("should call onError when an error occurs during reload", async () => {
      const observer = vi.fn();
      const onError = vi.fn();
      vi.spyOn(modelList, "reload").mockRejectedValue(new Error("Reload failed"));
      modelList.subscribe(observer, { onError });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(onError).toHaveBeenCalledWith(new Error("Reload failed"));
      expect(observer).not.toHaveBeenCalled();
    });

    // Test 20: Subscription behavior with batch updates
    it("should handle batch updates correctly with noReload option", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer, { noReload: true });

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1", "2"],
        data: [
          { _id: "1", someField: "updated1", _updatedAt: new Date(Date.now() + 10).toJSON() },
          { _id: "2", someField: "updated2", _updatedAt: new Date(Date.now() + 20).toJSON() },
        ],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1", "2"] });
      expect(observer).toHaveBeenCalledTimes(1);
    });

    it("should correctly subscribe to a fetched list", async () => {
      const body = JSON.stringify({
        data: {
          rows: [
            { _id: "3", someField: "value1", _updatedAt: new Date().toJSON() },
            { _id: "4", someField: "value2", _updatedAt: new Date().toJSON() },
          ],
          count: 2,
        },
      });

      mockFetch.mockResolvedValueOnce(new Response(body)); // First mock for the list first fetch

      const fetchedList = await model.getList();
      const observer = vi.fn();
      fetchedList.subscribe(observer);

      mockFetch.mockResolvedValueOnce(new Response(body)); // Second mock for the list reload

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["3"],
        data: [{ _id: "3", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["3"] });
    });

    it("should call the observer when an item in the list is updated", async () => {
      const mockFetch = vi.spyOn(global, "fetch");
      const body = JSON.stringify({ data: modelList.toJSON() });
      mockFetch.mockResolvedValueOnce(new Response(body));

      const observer = vi.fn();
      modelList.subscribe(observer);

      await new Promise(resolve => setTimeout(resolve, 1));

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledWith({ operation: "update", ids: ["1"] });
    });

    it("should call the observer once for multiple updates in rapid succession", async () => {
      const mockFetch = vi.spyOn(global, "fetch");
      const body = JSON.stringify({ data: modelList.toJSON() });
      mockFetch.mockResolvedValue(new Response(body));

      const observer = vi.fn();
      modelList.subscribe(observer);

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated1", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      adapter.dispatch({
        operation: "update",
        model: model.slug,
        ids: ["1"],
        data: [{ _id: "1", someField: "updated2", _updatedAt: new Date(Date.now() + 20).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer).toHaveBeenCalledTimes(1);
    });

    it("should call the observer when an item in the list is updated", async () => {
      const observer = vi.fn();
      const onLoadingChange = vi.fn();
      modelList.subscribe(observer, { onLoadingChange });

      const reloadSpy = vi.spyOn(modelList, "reload").mockResolvedValue();

      await new Promise(resolve => setTimeout(resolve, 0));

      const event: ModelUpdaterEvent = { operation: "update", ids: ["1"] };
      adapter.dispatch({
        ...event,
        model: model.slug,
        data: [{ _id: "1", someField: "updated", _updatedAt: new Date(Date.now() + 10).toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async operations

      expect(reloadSpy).toHaveBeenCalled();
      expect(onLoadingChange).toHaveBeenCalledWith(true);
      expect(onLoadingChange).toHaveBeenCalledWith(false);
      expect(observer).toHaveBeenCalledWith(event);
    });

    it("should call the observer when an item is added or removed from the list", async () => {
      const observer = vi.fn();
      modelList.subscribe(observer);

      const reloadSpy = vi.spyOn(modelList, "reload").mockImplementation(async () => {
        modelList.push(model.hydrate({ _id: "3", someField: "value3" }));
      });

      const createEvent: ModelUpdaterEvent = { operation: "create", ids: ["3"] };
      adapter.dispatch({
        ...createEvent,
        model: model.slug,
        data: [{ _id: "3", someField: "value3", _createdAt: new Date().toJSON(), _updatedAt: new Date().toJSON() }],
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async operations

      expect(reloadSpy).toHaveBeenCalled();
      expect(observer).toHaveBeenCalledWith(createEvent);

      reloadSpy.mockImplementation(async () => {
        modelList.remove(["2"]);
      });

      const deleteEvent: ModelUpdaterEvent = { operation: "delete", ids: ["2"] };
      adapter.dispatch({
        ...deleteEvent,
        model: model.slug,
        data: null,
      } as ModelCrudEvent<any, typeof model>);

      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async operations

      expect(reloadSpy).toHaveBeenCalled();
      expect(observer).toHaveBeenCalledWith(deleteEvent);
    });
  });

  describe("PromiseModel.prototype.cached", () => {
    it("should return null if the instance is not in cache", () => {
      const promise = model.get("non-existent-id");
      expect(promise.cached).toBeNull();
    });

    it("should return the cached instance if available", async () => {
      const instance = model.hydrate({ _id: "cached-id", someField: "value" });
      adapter.store.set("cached-id", instance);
      const promise = model.get("cached-id");
      expect(promise.cached).toBe(instance);
    });

    it("should return null for a query that doesn't use IDs", () => {
      const promise = model.get({ filter: { someField: "value" } });
      expect(promise.cached).toBeNull();
    });

    it("should work with single models", async () => {
      @modelDecorator()
      class SingleModel extends Model {
        static slug = "singleModel";
        static definition = {
          ...TestModel.definition,
          single: true,
        };
      }
      const singleModel = client.getModel(SingleModel);
      const singleAdapter = singleModel.getAdapter() as unknown as ClientAdapter;
      const instance = singleModel.hydrate({ _id: "single-id" });
      singleAdapter.store.set("single-id", instance);
      const promise = singleModel.get();
      expect(promise.cached).toBe(instance);
    });

    it("Model.prototype.get should pass the cached instance to the next field with a relation field", async () => {
      @modelDecorator()
      class RelModel extends Model {
        static slug = "model";
        static definition = {
          ...TestModel.definition,
          fields: {
            ...TestModel.definition.fields,
            rel: {
              type: FieldTypes.RELATION,
              options: {
                ref: TestModel.slug,
              },
              _tsModel: undefined as unknown as typeof TestModel,
            },
          },
        } satisfies ModelDefinition;
      }

      const instance = model.hydrateAndCache({ _id: new ObjectId().toString(), someField: "value" });
      const relModel = client.getModel(RelModel);
      const relInstance = relModel.hydrateAndCache({ _id: new ObjectId().toString(), rel: instance._id });
      const rel = relInstance?.get("rel") as PromiseModel<typeof TestModel>;
      expect(rel).toBeInstanceOf(PromiseModel);
      expect(rel.cached).toBe(instance);
      expect(relInstance.get("rel.someField")).toBe("value");
      // @ts-expect-error test - someField is undefined on a PromiseModel instance
      expect(relInstance.rel.someField).toBeUndefined();
      expect(relInstance.rel?.cached?.someField).toBe("value");
    });

    it("Model.prototype.get should pass the cached instance to the next field with a relation array field", async () => {
      @modelDecorator()
      class RelModel extends Model {
        static slug = "model";
        static definition = {
          ...TestModel.definition,
          fields: {
            ...TestModel.definition.fields,
            relArr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: TestModel.slug,
                  },
                  _tsModel: undefined as unknown as typeof TestModel,
                },
              },
            },
          },
        } satisfies ModelDefinition;
      }

      const instance1 = model.hydrateAndCache({ _id: new ObjectId().toString(), someField: "value1" });
      const instance2 = model.hydrateAndCache({ _id: new ObjectId().toString(), someField: "value2" });

      const relModel = client.getModel(RelModel);
      const relInstance = relModel.hydrateAndCache({
        _id: new ObjectId().toString(),
        relArr: [instance1._id as string, instance2._id as string],
      });
      const rel = relInstance.get("relArr") as PromiseModelList<typeof TestModel>;
      expect(rel).toBeInstanceOf(PromiseModelList);
      expect(rel.cached).toBeInstanceOf(ModelList);
      expect(rel.cached?.length).toBe(2);
      expect(rel.cached?.[0]).toBe(instance1);
      expect(rel.cached?.[1]).toBe(instance2);
      expect(relInstance.get("relArr.[0].someField")).toBe("value1");
      expect(relInstance.get("relArr.[1].someField")).toBe("value2");
      expect(relInstance.get("relArr.[2].someField")).toBe(undefined);
      expect(relInstance.get("relArr.[].someField")).toEqual(["value1", "value2"]);
    });
  });

  describe("PromiseModelList.prototype.cached", () => {
    it("should return null if no query is provided", () => {
      const promise = model.getList();
      expect(promise.cached).toBeNull();
    });

    it("should return null if the query doesn't use IDs", () => {
      const promise = model.getList({ filter: { someField: "value" } });
      expect(promise.cached).toBeNull();
    });

    it("should return null if not all instances are in cache", () => {
      const instance1 = model.hydrate({ _id: "id1", someField: "value1" });
      adapter.store.set("id1", instance1);
      const promise = model.getList({ ids: ["id1", "id2"] });
      expect(promise.cached).toBeNull();
    });

    it("should return a ModelList with cached instances if all are available", () => {
      const instance1 = model.hydrate({ _id: "id1", someField: "value1" });
      const instance2 = model.hydrate({ _id: "id2", someField: "value2" });
      adapter.store.set("id1", instance1);
      adapter.store.set("id2", instance2);
      const promise = model.getList({ ids: ["id1", "id2"] });
      const cached = promise.cached;
      expect(cached).toBeInstanceOf(ModelList);
      expect(cached?.length).toBe(2);
      expect(cached?.[0]).toBe(instance1);
      expect(cached?.[1]).toBe(instance2);
    });
  });

  describe("PromiseModelList.prototype.cachedPartial", () => {
    it("should return null if the query doesn't use IDs", () => {
      const promise = model.getList({ filter: { someField: "value" } });
      expect(promise.cachedPartial).toBeNull();
    });

    it("should return a ModelList with available cached instances", () => {
      const instance1 = model.hydrate({ _id: "id1", someField: "value1" });
      const instance2 = model.hydrate({ _id: "id2", someField: "value2" });
      adapter.store.set("id1", instance1);
      adapter.store.set("id2", instance2);
      const promise = model.getList({ ids: ["id1", "id2", "id3"] });
      const cachedPartial = promise.cachedPartial;
      expect(cachedPartial).toBeInstanceOf(ModelList);
      expect(cachedPartial?.length).toBe(2);
      expect(cachedPartial?.[0]).toBe(instance1);
      expect(cachedPartial?.[1]).toBe(instance2);
    });

    it("should return an empty ModelList if no instances are cached", () => {
      const promise = model.getList({ ids: ["id1", "id2"] });
      const cachedPartial = promise.cachedPartial;
      expect(cachedPartial).toBeInstanceOf(ModelList);
      expect(cachedPartial?.length).toBe(0);
    });

    it("should maintain the order of IDs from the original query", () => {
      const instance1 = model.hydrate({ _id: "id1", someField: "value1" });
      const instance2 = model.hydrate({ _id: "id2", someField: "value2" });
      const instance3 = model.hydrate({ _id: "id3", someField: "value3" });
      adapter.store.set("id1", instance1);
      adapter.store.set("id2", instance2);
      adapter.store.set("id3", instance3);
      const promise = model.getList({ ids: ["id3", "id1", "id4", "id2"] });
      const cachedPartial = promise.cachedPartial;
      expect(cachedPartial).toBeInstanceOf(ModelList);
      expect(cachedPartial?.length).toBe(3);
      expect(cachedPartial?.[0]).toBe(instance3);
      expect(cachedPartial?.[1]).toBe(instance1);
      expect(cachedPartial?.[2]).toBe(instance2);
    });
  });
});
