import { ModelUpdaterEvent } from "../../types";
import { generateModel, getClientWithSocket } from "../../lib/test-utils";
import { Model, ModelList } from "@graphand/core";

const TIMEOUT = 300;

const _captureEventsOnModel = async (
  model: typeof Model,
  waitingDelay = TIMEOUT
): Promise<Array<ModelUpdaterEvent>> => {
  const events: Array<ModelUpdaterEvent> = [];

  const unsub = model.subscribe((e: ModelUpdaterEvent) => {
    Array.prototype.push.apply(events, [e]);
  });

  await new Promise((resolve) => setTimeout(resolve, waitingDelay));

  unsub();
  return events;
};

const _captureEventsOnInstance = async (
  instance: Model,
  waitingDelay = 300
): Promise<number> => {
  let eventsCount = 0;

  const unsub = instance.subscribe(() => {
    eventsCount++;
  });

  await new Promise((resolve) => setTimeout(resolve, waitingDelay));

  unsub();
  return eventsCount;
};

const _captureEventsOnList = async (
  list: ModelList<Model>,
  waitingDelay = 300
): Promise<number> => {
  let eventsCount = 0;

  const unsub = list.subscribe((e: any) => {
    eventsCount++;
  });

  await new Promise((resolve) => setTimeout(resolve, waitingDelay));

  unsub();
  return eventsCount;
};

describe("test subscribe feature", () => {
  describe("on Model", () => {
    it("should emit one event when an instance is created locally", async () => {
      const model = await generateModel();

      const eventsPromise = _captureEventsOnModel(model);

      const doc = await model.create({ title: "test" });

      const events = await eventsPromise;
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        operation: "create",
        ids: [doc._id],
      });
    });

    it("should emit one event when data is fetched", async () => {
      const model = await generateModel();

      const doc = await model.create({ title: "test" });

      const eventsPromise = _captureEventsOnModel(model);

      model.clearCache();

      await model.get(doc._id);

      const events = await eventsPromise;
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        operation: "fetch",
        ids: [doc._id],
      });
    });

    it("should emit one event when receive data on socket", async () => {
      const model = await generateModel();
      const clientWithSocket = getClientWithSocket();

      const eventsPromise = _captureEventsOnModel(
        clientWithSocket.getModel(model)
      );

      const doc = await model.create({ title: "test" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const events = await eventsPromise;

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        operation: "create",
        ids: [doc._id],
      });
    });

    it("should not emit any event when data is fetched but already in cache", async () => {
      const model = await generateModel();

      const doc = await model.create({ title: "test" });

      const eventsPromise = _captureEventsOnModel(model);

      await model.get(doc._id);

      const events = await eventsPromise;
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(0);
    });

    it("should emit one event when data is created on socket", async () => {
      const model = await generateModel();

      const modelSocket = getClientWithSocket().getModel(model);

      const eventsPromise = _captureEventsOnModel(modelSocket);

      const doc = await model.create({ title: "test" });

      const events = await eventsPromise;
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        operation: "create",
        ids: [doc._id],
      });
    });
  });

  describe("on Model.prototype", () => {
    it("should trigger callback when document is updated", async () => {
      const model = await generateModel();

      const doc = await model.create({ title: "test" });

      const eventsPromise = _captureEventsOnInstance(doc);

      await doc.update({ $set: { title: "test2" } });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback when document is updated through socket", async () => {
      const model = await generateModel();
      const clientWithSocket = getClientWithSocket();

      const doc = await model.create({ title: "test" });
      const docOnSocket = await clientWithSocket.getModel(model).get(doc._id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const eventsPromise = _captureEventsOnInstance(docOnSocket);

      await doc.update({ $set: { title: "test2" } });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback when document is deleted", async () => {
      const model = await generateModel();

      const doc = await model.create({ title: "test" });

      const eventsPromise = _captureEventsOnInstance(doc);

      await doc.delete();

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback when document is deleted through socket", async () => {
      const model = await generateModel();
      const clientWithSocket = getClientWithSocket();

      const doc = await model.create({ title: "test" });
      const docOnSocket = await clientWithSocket.getModel(model).get(doc._id);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const eventsPromise = _captureEventsOnInstance(docOnSocket);

      await doc.delete();

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should not trigger callback when another document is created on model", async () => {
      const model = await generateModel();

      const doc = await model.create({ title: "test" });

      const eventsPromise = _captureEventsOnInstance(doc);

      await model.create({ title: "test2" });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(0);
    });
  });

  describe("on ModelList.prototype", () => {
    it("should trigger callback one time when a document in list is updated", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: `test${i}` }))
      );

      const list = await model.getList({ ids: docs.map((d) => d._id) });

      const eventsPromise = _captureEventsOnList(list);

      await docs[3].update({ $set: { title: "test" } });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback one time when multiple documents in list are updated", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "test" + i }))
      );

      const list = await model.getList({ ids: docs.map((d) => d._id) });

      const eventsPromise = _captureEventsOnList(list);

      await model.update(
        {
          ids: [docs[3]._id],
        },
        {
          $set: { title: "test" },
        }
      );

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback multiple times when multiple documents in list are updated individually", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "test" + i }))
      );

      const list = await model.getList({ ids: docs.map((d) => d._id) });

      const eventsPromise = _captureEventsOnList(list);

      await docs[3].update({ $set: { title: "testEdited1" } });
      await docs[4].update({ $set: { title: "testEdited2" } });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(2);
    });

    it("should trigger callback when a document in list is updated", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "test" + i }))
      );

      const list = await model.getList({
        ids: docs.slice(5, 10).map((d) => d._id),
      });

      const eventsPromise = _captureEventsOnList(list);

      await model.update(
        {
          ids: [docs[2]._id],
        },
        {
          $set: { title: "test" },
        }
      );

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback when a document in list is updated, then list should be updated", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "inList" + i }))
      );

      const list = await model.getList({
        filter: {
          title: {
            $regex: "inList",
          },
        },
      });

      expect(list.length).toBe(10);

      const eventsPromise = _captureEventsOnList(list);

      await docs[3].update({ $set: { title: "notInList" } });

      const eventsCount = await eventsPromise;

      expect(list.length).toBe(9);

      expect(eventsCount).toBe(1);
    });

    it("should stack received events while list is reloading, then not trigger if not needed", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "inList" + i }))
      );

      const list = await model.getList({
        filter: {
          title: {
            $regex: "inList",
          },
        },
      });

      expect(list.length).toBe(10);

      const eventsPromise = _captureEventsOnList(list);

      await docs[3].update({ $set: { title: "notInList" } });
      await docs[3].update({ $set: { title: "notInListBis" } });
      await docs[3].update({ $set: { title: "notInListBis2" } });

      const eventsCount = await eventsPromise;

      await list.reloadPromise;

      expect(list.length).toBe(9);

      expect(eventsCount).toBe(1);
    });

    it("should stack received events while list is reloading, then trigger again if needed", async () => {
      const model = await generateModel();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: "inList" + i }))
      );

      const list = await model.getList({
        filter: {
          title: {
            $regex: "inList",
          },
        },
      });

      expect(list.length).toBe(10);

      const eventsPromise = _captureEventsOnList(list, 500);

      await docs[3].update({ $set: { title: "notInList" } });

      await list.reloadPromise;

      expect(list.length).toBe(9);
      expect(list).not.toContain(docs[3]);

      await docs[3].update({ $set: { title: "inList" } });

      await list.reloadPromise;

      expect(list.length).toBe(10);
      expect(list).toContain(docs[3]);

      await docs[3].update({ $set: { title: "notInList" } });

      await docs[3].update({ $set: { title: "notInListBis" } });

      await docs[3].update({ $set: { title: "notInListBis2" } });

      await docs[3].update({ $set: { title: "inList" } });

      await list.reloadPromise;

      expect(list.length).toBe(10);
      expect(list).toContain(docs[3]);

      const eventsCount = await eventsPromise;

      expect(eventsCount).toBe(4);
    });

    it("should trigger callback one time when a document in list is updated through socket", async () => {
      const model = await generateModel();
      const clientWithSocket = getClientWithSocket();

      const docs = await model.createMultiple(
        Array.from({ length: 10 }, (_, i) => ({ title: `test${i}` }))
      );

      const list = await clientWithSocket
        .getModel(model)
        .getList({ ids: docs.map((d) => d._id) });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const eventsPromise = _captureEventsOnList(list);

      await docs[3].update({ $set: { title: "test" } });

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });

    it("should trigger callback one time when a document in list is updated even with a socket connected", async () => {
      const model = await generateModel();
      const clientWithSocket = getClientWithSocket();

      const docs = await clientWithSocket
        .getModel(model)
        .createMultiple(
          Array.from({ length: 10 }, (_, i) => ({ title: `test${i}` }))
        );

      const list = await clientWithSocket
        .getModel(model)
        .getList({ ids: docs.map((d) => d._id) });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const eventsPromise = _captureEventsOnList(list);

      clientWithSocket.getModel(model).update(
        {
          ids: [docs[3]._id],
        },
        {
          $set: { title: "test" },
        }
      );

      const eventsCount = await eventsPromise;
      expect(eventsCount).toBe(1);
    });
  });
});
