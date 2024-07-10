import { ModelUpdaterEvent } from "@/types";
import { FieldTypes, Model, ModelCrudEvent, modelDecorator, ModelInstance } from "@graphand/core";
import { Client } from "./lib/Client";
import { ClientAdapter } from "./lib/ClientAdapter";

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

  beforeEach(() => {
    client = new Client([], { accessToken: "test-token", project: "test-project" });
    model = client.getModel(TestModel);
    adapter = model.getAdapter() as ClientAdapter;
  });

  describe("Model.subscribe", () => {
    it("should return a function when subscribed", () => {
      const unsubscribe = model.subscribe(() => {});
      expect(typeof unsubscribe).toBe("function");
    });

    it("should call the observer when an event is dispatched", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls[0][0]).toEqual(event);
    });

    it("should not call the observer after unsubscribing", () => {
      const observer = jest.fn();
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
      const observer1 = jest.fn();
      const observer2 = jest.fn();

      model.subscribe(observer1);
      model.subscribe(observer2);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer1).toHaveBeenCalled();
      expect(observer2).toHaveBeenCalled();
      expect(observer1.mock.calls[0][0]).toEqual(event);
      expect(observer2.mock.calls[0][0]).toEqual(event);
    });

    it("should handle create events", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls[0][0]).toEqual(event);
    });

    it("should handle update events", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls[0][0]).toEqual(event);
    });

    it("should handle delete events", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      adapter.instancesMap.set("123", model.hydrate({ _id: "123" }));
      const event: ModelUpdaterEvent = { operation: "delete", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
      expect(observer.mock.calls[0][0]).toEqual(event);
    });

    it("should not call the observer for events from other models", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      class OtherModel extends Model {
        static slug = "otherModel";
      }

      const adapter2 = client.getModel(OtherModel).getAdapter() as ClientAdapter;

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter2.dispatch({ ...event, model: "otherModel", data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should work with async observers", async () => {
      const asyncObserver = jest.fn().mockImplementation(() => Promise.resolve());
      model.subscribe(asyncObserver);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(asyncObserver).toHaveBeenCalled();
      expect(asyncObserver.mock.calls[0][0]).toEqual(event);
    });

    it("should not call the observer for events with empty ids", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: [] };
      adapter.dispatch({ ...event, model: model.slug, data: [] } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle multiple events in quick succession", () => {
      const observer = jest.fn();
      model.subscribe(observer);

      const events: ModelUpdaterEvent[] = [
        { operation: "create", ids: ["1"] },
        { operation: "update", ids: ["1"] },
        { operation: "delete", ids: ["1"] },
      ];

      events.forEach(event => {
        adapter.dispatch({
          ...event,
          model: model.slug,
          data: event.operation === "delete" ? null : [{ _id: event.ids[0], _updatedAt: JSON.stringify(new Date()) }],
        } as ModelCrudEvent<any, typeof model>);
      });

      expect(observer).toHaveBeenCalledTimes(3);
      expect(observer.mock.calls[0][0]).toEqual(events[0]);
      expect(observer.mock.calls[1][0]).toEqual(events[1]);
      expect(observer.mock.calls[2][0]).toEqual(events[2]);
    });

    it("should handle subscription immediately after model creation", () => {
      const NewModel = modelDecorator()(
        class extends Model {
          static slug = "newModel";
        },
      );
      const newModel = client.getModel(NewModel);
      const newAdapter = newModel.getAdapter() as ClientAdapter;

      const observer = jest.fn();
      const unsubscribe = newModel.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "create", ids: ["123"] };
      newAdapter.dispatch({ ...event, model: newModel.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      expect(observer.mock.calls[0][0]).toEqual(event);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should handle a large number of subscriptions", () => {
      const observers = Array.from({ length: 1000 }, () => jest.fn());
      observers.forEach(observer => model.subscribe(observer));

      const event: ModelUpdaterEvent = { operation: "update", ids: ["123"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "123" }] } as ModelCrudEvent<
        "update",
        typeof model
      >);

      observers.forEach(observer => {
        expect(observer.mock.calls[0][0]).toEqual(event);
      });
    });

    it("should maintain separate subscriptions for different models", () => {
      @modelDecorator()
      class OtherModel extends Model {
        static slug = "otherModel";
      }
      const otherModel = client.getModel(OtherModel);
      const otherAdapter = otherModel.getAdapter() as ClientAdapter;

      const observer1 = jest.fn();
      const observer2 = jest.fn();

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
      const observer = jest.fn();
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
      const observer = jest.fn();
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
      const extendedAdapter = extendedModel.getAdapter() as ClientAdapter;

      const observer = jest.fn();
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
      adapter.instancesMap.set("1", instance1);
      adapter.instancesMap.set("2", instance2);

      expect(adapter.instancesMap.size).toBe(2);

      model.clearCache();

      expect(adapter.instancesMap.size).toBe(0);
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
      const otherAdapter = otherModel.getAdapter() as ClientAdapter;

      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      const instance2 = OtherModel.hydrate({ _id: "2", someField: "value2" });
      adapter.instancesMap.set("1", instance1);
      otherAdapter.instancesMap.set("2", instance2);

      model.clearCache();

      expect(adapter.instancesMap.size).toBe(0);
      expect(otherAdapter.instancesMap.size).toBe(1);
    });

    it("should work with an empty cache", () => {
      expect(adapter.instancesMap.size).toBe(0);
      model.clearCache();
      expect(adapter.instancesMap.size).toBe(0);
    });

    it("should clear cache for inherited model classes", () => {
      class ExtendedModel extends TestModel {
        static slug = "extendedModel";
      }
      const extendedModel = client.getModel(ExtendedModel);
      const extendedAdapter = extendedModel.getAdapter() as ClientAdapter;

      const instance = ExtendedModel.hydrate({ _id: "1", someField: "value" });
      extendedAdapter.instancesMap.set("1", instance);

      expect(extendedAdapter.instancesMap.size).toBe(1);
      extendedModel.clearCache();
      expect(extendedAdapter.instancesMap.size).toBe(0);
    });

    it("should allow adding new instances after clearing the cache", () => {
      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      adapter.instancesMap.set("1", instance1);

      model.clearCache();

      const instance2 = TestModel.hydrate({ _id: "2", someField: "value2" });
      adapter.instancesMap.set("2", instance2);

      expect(adapter.instancesMap.size).toBe(1);
      expect(adapter.instancesMap.get("2")).toBe(instance2);
    });

    it("should not interfere with model's ability to create new instances", () => {
      model.clearCache();

      const newInstance = TestModel.hydrate({ _id: "1", someField: "value" });
      expect(newInstance).toBeInstanceOf(TestModel);
      expect(newInstance.get("_id")).toBe("1");
    });

    it("should clear cache multiple times without errors", () => {
      const instance = TestModel.hydrate({ _id: "1", someField: "value" });
      adapter.instancesMap.set("1", instance);

      model.clearCache();
      expect(adapter.instancesMap.size).toBe(0);

      model.clearCache();
      expect(adapter.instancesMap.size).toBe(0);

      model.clearCache();
      expect(adapter.instancesMap.size).toBe(0);
    });

    it("should work correctly when called in combination with other methods", async () => {
      const instance1 = TestModel.hydrate({ _id: "1", someField: "value1" });
      adapter.instancesMap.set("1", instance1);

      const fetchSpy = jest.spyOn(global, "fetch");
      fetchSpy.mockResolvedValue(new Response('{"data": {"_id": "1", "someField": "updated"}}', { status: 200 }));

      model.clearCache();

      const refetchedInstance = await model.get("1");

      expect(fetchSpy).toHaveBeenCalled();
      expect(refetchedInstance?.get("someField")).toBe("updated");
      expect(adapter.instancesMap.size).toBe(1);

      fetchSpy.mockRestore();
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
      const observer = jest.fn();
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
      const observer = jest.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "update", ids: ["other-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: [{ _id: "other-id", someField: "test123" }] } as any);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should call the observer when the instance is deleted", () => {
      const observer = jest.fn();
      instance.subscribe(observer);
      adapter.instancesMap.set(instance._id, instance);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["test-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer after unsubscribing", () => {
      const observer = jest.fn();
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
      const observer1 = jest.fn();
      const observer2 = jest.fn();

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
      const observer = jest.fn();
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
      const observer = jest.fn();
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
      const observer = jest.fn();
      instance.subscribe(observer);
      adapter.instancesMap.set(instance._id, instance);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["test-id", "other-id"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).toHaveBeenCalled();
    });

    it("should not call the observer for deleteMultiple events that don't include the instance", () => {
      const observer = jest.fn();
      instance.subscribe(observer);

      const event: ModelUpdaterEvent = { operation: "delete", ids: ["other-id-1", "other-id-2"] };
      adapter.dispatch({ ...event, model: model.slug, data: null } as ModelCrudEvent<any, typeof model>);

      expect(observer).not.toHaveBeenCalled();
    });

    it("should handle create events (even though they shouldn't affect an existing instance)", () => {
      adapter.instancesMap.set("test-id", instance);
      const observer = jest.fn();
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
      const asyncObserver = jest.fn().mockImplementation(() => Promise.resolve());
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
      const observer = jest.fn();
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
      const spyFetch = jest.spyOn(global, "fetch");
      spyFetch.mockResolvedValueOnce(new Response('{"data": {"_id": "test-id", "someField": "test123"}}'));

      const i = await model.get("test-id");
      expect(i.someField).toBe("test123");

      const observer = jest.fn();
      i.subscribe(observer);

      spyFetch.mockResolvedValueOnce(
        new Response('{"data": {"_id": "test-id", "someField": "updated", "_updatedAt": "2023-05-01T10:00:00.000Z"}}'),
      );
      await i.update({ $set: { someField: "updated" } });
      expect(i.someField).toBe("updated");

      expect(observer).toHaveBeenCalledWith(
        { _id: "test-id", someField: "test123" },
        { operation: "update", ids: ["test-id"] },
      );

      spyFetch.mockResolvedValueOnce(
        new Response('{"data": {"_id": "test-id", "someField": "updated2", "_updatedAt": "2023-05-02T10:00:00.000Z"}}'),
      );
      await i.update({ $set: { someField: "updated2" } });
      expect(i.someField).toBe("updated2");

      expect(observer).toHaveBeenCalledWith(
        { _id: "test-id", someField: "updated", _updatedAt: "2023-05-01T10:00:00.000Z" },
        { operation: "update", ids: ["test-id"] },
      );
    });

    it("should handle multiple updates in rapid succession", async () => {
      const observer = jest.fn();
      instance.subscribe(observer);
      adapter.instancesMap.set("test-id", instance);

      const updateEvents = [{ someField: "update1" }, { someField: "update2" }, { someField: "update3" }];

      const fetchSpy = jest.spyOn(global, "fetch");

      for (const update of updateEvents) {
        const body = JSON.stringify({ data: { ...instance.getData(), ...update, _updatedAt: new Date().toJSON() } });
        fetchSpy.mockResolvedValueOnce(new Response(body));
        await instance.update({ $set: update });
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      expect(observer).toHaveBeenCalledTimes(3);

      expect(observer.mock.calls[0][0]).toEqual({ _id: "test-id" });
      expect(observer.mock.calls[0][1]).toEqual({ operation: "update", ids: ["test-id"] });
      expect(observer.mock.calls[1][0]).toHaveProperty("someField", "update1");
      expect(observer.mock.calls[1][1]).toEqual({ operation: "update", ids: ["test-id"] });
      expect(observer.mock.calls[2][0]).toHaveProperty("someField", "update2");
      expect(observer.mock.calls[2][1]).toEqual({ operation: "update", ids: ["test-id"] });

      expect(instance.getData()).toHaveProperty("someField", "update3");
    });
  });

  describe("ModelList.prototype.subscribe", () => {});
});
