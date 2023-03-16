import {
  fetchWatcher,
  generateModel,
  generateRandomString,
} from "../../lib/test-utils";
import { Model } from "@graphand/core";
import ClientAdapter from "../../lib/ClientAdapter";
import { FieldTextDefinition } from "@graphand/core/src/fields";

class TestModel extends Model {
  title: FieldTextDefinition;
}

describe("ClientAdapter", () => {
  let model: typeof TestModel;

  beforeAll(async () => {
    model = await generateModel();
  });

  describe("ClientAdapter.create", () => {
    it("Model.create should returns the created instance", async () => {
      const created = await model.create({ title: "title" });
      expect(created).toBeInstanceOf(model);
      expect(typeof created._id).toBe("string");
      expect(created.title).toBe("title");
    });

    it("Model.create should emit on updater subject", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const eventPromise = new Promise((resolve) => {
        const unsub = adapter.updaterSubject.subscribe((e) => {
          unsub();
          resolve(e);
        });

        setTimeout(() => {
          unsub();
          resolve(null);
        }, 1000);
      });

      const created = await model.create({ title: "title" });

      await expect(eventPromise).resolves.toEqual({
        operation: "create",
        ids: [created._id],
      });
    });

    it("Model.create should add instances to map and then returns from get", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const created = await model.create({ title: "title" });

      expect(adapter.instancesMap.get(created._id)).toBe(created);

      let fetchWatcherPromise = fetchWatcher(model, created._id);

      await expect(model.get(created._id)).resolves.toBe(created);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();

      fetchWatcherPromise = fetchWatcher(model, created._id);

      await expect(model.get({ filter: { _id: created._id } })).resolves.toBe(
        created
      );

      await expect(fetchWatcherPromise).resolves.toBeTruthy();
    });
  });

  describe("ClientAdapter.createMultiple", () => {
    it("Model.createMultiple should returns the created instances", async () => {
      const title1 = generateRandomString();
      const title2 = generateRandomString();

      const created = await model.createMultiple([
        { title: title1 },
        { title: title2 },
      ]);
      expect(Array.isArray(created)).toBeTruthy();
      expect(created.length).toBe(2);
      expect(created[0]).toBeInstanceOf(model);
      expect(created[1]).toBeInstanceOf(model);
      expect(typeof created[0]._id).toBe("string");
      expect(typeof created[1]._id).toBe("string");
      expect(created[0].title).toBe(title1);
      expect(created[1].title).toBe(title2);
    });

    it("Model.createMultiple should emit on updater subject", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const eventPromise = new Promise((resolve) => {
        const unsub = adapter.updaterSubject.subscribe((e) => {
          unsub();
          resolve(e);
        });

        setTimeout(() => {
          unsub();
          resolve(null);
        }, 1000);
      });

      const title1 = generateRandomString();
      const title2 = generateRandomString();

      const created = await model.createMultiple([
        { title: title1 },
        { title: title2 },
      ]);

      await expect(eventPromise).resolves.toEqual({
        operation: "create",
        ids: [created[0]._id, created[1]._id],
      });
    });

    it("Model.createMultiple should add instances to map and then returns from get", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const title1 = generateRandomString();
      const title2 = generateRandomString();

      const created = await model.createMultiple([
        { title: title1 },
        { title: title2 },
      ]);

      expect(adapter.instancesMap.get(created[0]._id)).toBe(created[0]);
      expect(adapter.instancesMap.get(created[1]._id)).toBe(created[1]);

      let fetchWatcher1 = fetchWatcher(model, created[0]._id);
      let fetchWatcher2 = fetchWatcher(model, created[1]._id);

      await expect(model.get(created[0]._id)).resolves.toBe(created[0]);
      await expect(model.get(created[1]._id)).resolves.toBe(created[1]);

      await expect(fetchWatcher1).resolves.toBeFalsy();
      await expect(fetchWatcher2).resolves.toBeFalsy();

      fetchWatcher1 = fetchWatcher(model, created[0]._id);
      fetchWatcher2 = fetchWatcher(model, created[1]._id);

      await model.getList({ ids: [created[0]._id, created[1]._id] });

      await expect(fetchWatcher1).resolves.toBeTruthy();
      await expect(fetchWatcher2).resolves.toBeTruthy();
    });
  });
});
