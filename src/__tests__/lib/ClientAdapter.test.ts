import {
  fetchWatcher,
  generateModel,
  generateRandomString,
} from "../../lib/test-utils";
import { Model, FieldTypes } from "@graphand/core";
import ClientAdapter from "../../lib/ClientAdapter";

class TestModel extends Model {
  title: FieldDefinitionText;
}

class TestModel2 extends Model {
  title: FieldDefinitionText;
  relSingle: FieldDefinitionRelation<TestModel>;
  relMultiple: FieldDefinitionArray<{
    type: FieldTypes.RELATION;
    definition: TestModel;
  }>;
  obj: FieldDefinitionNested<{
    nestedRelSingle: FieldDefinitionRelation<TestModel>;
    nestedRelMultiple: FieldDefinitionArray<{
      type: FieldTypes.RELATION;
      definition: TestModel;
    }>;
  }>;
}

class TestModel3 extends Model {
  title: FieldDefinitionText;
  relSingle: FieldDefinitionRelation<TestModel2>;
  relMultiple: FieldDefinitionArray<{
    type: FieldTypes.RELATION;
    definition: TestModel2;
  }>;
}

describe("ClientAdapter", () => {
  let model: typeof TestModel;
  let model2: typeof TestModel2;
  let model3: typeof TestModel3;

  beforeAll(async () => {
    model = (await generateModel()) as typeof model;
    model2 = (await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      relSingle: {
        type: FieldTypes.RELATION,
        options: {
          ref: model.slug,
        },
      },
      relMultiple: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.RELATION,
            options: {
              ref: model.slug,
            },
          },
        },
      },
      obj: {
        type: FieldTypes.NESTED,
        options: {
          fields: {
            nestedRelSingle: {
              type: FieldTypes.RELATION,
              options: {
                ref: model.slug,
              },
            },
            nestedRelMultiple: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: model.slug,
                  },
                },
              },
            },
          },
        },
      },
    })) as typeof model2;
    model3 = (await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      relSingle: {
        type: FieldTypes.RELATION,
        options: {
          ref: model2.slug,
        },
      },
      relMultiple: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.RELATION,
            options: {
              ref: model2.slug,
            },
          },
        },
      },
    })) as typeof model3;
  });

  describe("ClientAdapter.create", () => {
    it("Model.create should returns the created instance", async () => {
      const created = await model.create({ title: "title" });
      expect(created).toBeInstanceOf(model);
      expect(typeof created._id).toBe("string");
      expect(created.title).toBe("title");
    });

    it("Model.create should emit on updater subject", async () => {
      const adapter = model.getAdapter() as ClientAdapter;

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
      const adapter = model.getAdapter() as ClientAdapter;

      const created = await model.create({ title: "title" });

      expect(adapter.instancesMap.get(created._id)).toBe(created);

      let fetchWatcherPromise = fetchWatcher(model, { _id: created._id });

      await expect(model.get(created._id)).resolves.toBe(created);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();

      fetchWatcherPromise = fetchWatcher(model, { _id: created._id });

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
      const adapter = model.getAdapter() as ClientAdapter;

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

      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(eventPromise).resolves.toEqual({
        operation: "create",
        ids: [created[0]._id, created[1]._id],
      });
    });

    it("Model.createMultiple should add instances to map and then returns from get", async () => {
      const adapter = model.getAdapter() as ClientAdapter;

      const title1 = generateRandomString();
      const title2 = generateRandomString();

      const created = await model.createMultiple([
        { title: title1 },
        { title: title2 },
      ]);

      expect(adapter.instancesMap.get(created[0]._id)).toBe(created[0]);
      expect(adapter.instancesMap.get(created[1]._id)).toBe(created[1]);

      let fetchWatcher1 = fetchWatcher(model, { _id: created[0]._id });
      let fetchWatcher2 = fetchWatcher(model, { _id: created[1]._id });

      await expect(model.get(created[0]._id)).resolves.toBe(created[0]);
      await expect(model.get(created[1]._id)).resolves.toBe(created[1]);

      await expect(fetchWatcher1).resolves.toBeFalsy();
      await expect(fetchWatcher2).resolves.toBeFalsy();

      fetchWatcher1 = fetchWatcher(model, { _id: created[0]._id });
      fetchWatcher2 = fetchWatcher(model, { _id: created[1]._id });

      await model.getList({
        filter: { _id: { $in: [created[0]._id, created[1]._id] } },
      });

      await expect(fetchWatcher1).resolves.toBeTruthy();
      await expect(fetchWatcher2).resolves.toBeTruthy();
    });
  });

  describe("ClientAdapter.get", () => {
    it("Model.get should returns the instance from _id", async () => {
      const created = await model.create({ title: "title" });

      const fetched = await model.get(created._id);

      expect(fetched).toBeInstanceOf(model);
      expect(fetched._id).toBe(created._id);
      expect(fetched.title).toBe(created.title);
    });

    it("Model.get should returns the instance from filter", async () => {
      const title = generateRandomString();

      const created = await model.create({ title });

      const fetched = await model.get({ filter: { title } });

      expect(fetched).toBeInstanceOf(model);
      expect(fetched._id).toBe(created._id);
      expect(fetched.title).toBe(created.title);
    });

    it("Model.get should returns the instance from ids without fetching", async () => {
      const title = generateRandomString();

      const created = await model.create({ title });

      const fetchWatcherPromise = fetchWatcher(model, { _id: created._id });

      const fetched = await model.get({ ids: [created._id] });

      expect(fetched).toBeInstanceOf(model);
      expect(fetched._id).toBe(created._id);
      expect(fetched.title).toBe(created.title);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();
    });

    it("Model.get should returns the instance from instancesMap", async () => {
      const created = await model.create({ title: "title" });

      const fetched = await model.get(created._id);

      expect(fetched).toBeInstanceOf(model);
      expect(fetched).toBe(created);
    });

    it("Model.get should returns the instance from instancesMap when fetching", async () => {
      const created = await model.create({ title: "title" });

      const fetched = await model.get({
        filter: { $expr: { $eq: ["$_id", { $toObjectId: created._id }] } },
      });

      expect(fetched).toBeInstanceOf(model);
      expect(fetched).toBe(created);
    });

    it("Model.get should emit fetch event on updaterSubject", async () => {
      const created = await model.create({ title: "title" });

      const fetchWatcherPromiseFetch = fetchWatcher(model, {
        _id: created._id,
      });
      const fetchWatcherPromiseLocalUpdate = fetchWatcher(model, {
        _id: created._id,
        operation: "localUpdate",
      });

      await model.get({ filter: { _id: created._id } });

      await expect(fetchWatcherPromiseFetch).resolves.toBeTruthy();
      await expect(fetchWatcherPromiseLocalUpdate).resolves.toBeFalsy();
    });

    it("Model.get should emit localUpdate event on updaterSubject if upserted in instancesMap", async () => {
      const created = await model.create({ title: "title" });

      const adapter = model.getAdapter() as ClientAdapter;
      adapter.instancesMap.delete(created._id);

      const fetchWatcherPromiseFetch = fetchWatcher(model, {
        _id: created._id,
      });
      const fetchWatcherPromiseLocalUpdate = fetchWatcher(model, {
        _id: created._id,
        operation: "localUpdate",
      });

      await model.get({ ids: [created._id] });

      await expect(fetchWatcherPromiseFetch).resolves.toBeTruthy();
      await expect(fetchWatcherPromiseLocalUpdate).resolves.toBeTruthy();
    });
  });

  describe("ClientAdapter.getList", () => {
    it("Model.getList should returns the instances from ids", async () => {
      const title1 = generateRandomString();
      const title2 = generateRandomString();

      const [created1, created2] = await model.createMultiple([
        { title: title1 },
        { title: title2 },
      ]);

      const fetched = await model.getList({
        filter: { _id: { $in: [created1._id, created2._id] } },
      });

      expect(Array.isArray(fetched)).toBeTruthy();
      expect(fetched.length).toBe(2);
      expect(fetched[0]).toBeInstanceOf(model);
      expect(fetched[1]).toBeInstanceOf(model);
      expect(fetched[0]).toBe(created1);
      expect(fetched[1]).toBe(created2);
    });

    it("Model.getList should not fetch ids in cache", async () => {
      const [created1, created2] = await model.createMultiple([
        { title: generateRandomString() },
        { title: generateRandomString() },
      ]);

      const fetchWatcherPromise = fetchWatcher(model, { _id: created1._id });

      const fetchedList = await model.getList({
        ids: [created1._id, created2._id],
      });

      expect(fetchedList.length).toBe(2);
      expect(fetchedList.count).toBe(2);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();
    });

    it("Model.getList should fetch only ids not in cache if querying ids", async () => {
      const [created1, created2] = await model.createMultiple([
        { title: generateRandomString() },
        { title: generateRandomString() },
      ]);

      let fetchWatcherPromise1 = fetchWatcher(model, { _id: created1._id });
      let fetchWatcherPromise2 = fetchWatcher(model, { _id: created2._id });

      const adapter = model.getAdapter() as ClientAdapter;
      adapter.instancesMap.delete(created1._id);

      const fetchedList = await model.getList({
        ids: [created1._id, created2._id],
      });

      expect(fetchedList.length).toBe(2);
      expect(fetchedList.count).toBe(2);

      await expect(fetchWatcherPromise1).resolves.toBeTruthy();
      await expect(fetchWatcherPromise2).resolves.toBeFalsy();
    });

    it("Model.getList should fetch only ids not in cache if querying ids and keep order", async () => {
      const createdList = await model.createMultiple(
        Array(10).fill({ title: generateRandomString() })
      );

      const ids = createdList.map((item) => item._id);

      const adapter = model.getAdapter() as ClientAdapter;
      adapter.instancesMap.delete(createdList[0]._id);
      adapter.instancesMap.delete(createdList[2]._id);
      adapter.instancesMap.delete(createdList[3]._id);
      adapter.instancesMap.delete(createdList[7]._id);

      const fetchedList = await model.getList({ ids: [...ids] });

      expect(fetchedList.length).toBe(10);
      expect(fetchedList.count).toBe(10);
      expect(fetchedList.getIds()).toEqual(ids);
    });

    it("Model.getList should fetch entire list if needed", async () => {
      const createdList = await model.createMultiple(
        Array(10).fill({ title: generateRandomString() })
      );

      const ids = createdList.map((item) => item._id);

      const adapter = model.getAdapter() as ClientAdapter;
      adapter.instancesMap.delete(createdList[0]._id);
      adapter.instancesMap.delete(createdList[2]._id);
      adapter.instancesMap.delete(createdList[3]._id);
      adapter.instancesMap.delete(createdList[7]._id);

      const fetchWatcherPromise = fetchWatcher(model, {
        _id: createdList[1]._id,
      });

      const fetchedList = await model.getList({
        ids: [...ids],
        filter: { title: { $exists: true } },
      });

      expect(fetchedList.length).toBe(10);
      expect(fetchedList.count).toBe(10);
      expect(fetchedList.getIds()).toEqual(ids);

      await expect(fetchWatcherPromise).resolves.toBeTruthy();
    });

    it("Model.getList should respect pagination", async () => {
      const createdList = await model.createMultiple(
        Array(10).fill({ title: generateRandomString() })
      );

      const ids = createdList.map((item) => item._id);

      const fetchWatcherPromise = fetchWatcher(model, {
        _id: createdList[0]._id,
      });

      const fetchedList = await model.getList({
        ids: [...ids],
        pageSize: 5,
        page: 2,
      });

      expect(fetchedList.length).toBe(5);
      expect(fetchedList.count).toBe(10);

      expect(fetchedList[0]).toBe(createdList[5]);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();
    });
  });
});
