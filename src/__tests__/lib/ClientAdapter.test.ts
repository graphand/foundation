import {
  fetchWatcher,
  generateModel,
  generateRandomString,
} from "../../lib/test-utils";
import { Model, FieldTypes, ModelList } from "@graphand/core";
import ClientAdapter from "../../lib/ClientAdapter";

class TestModel extends Model {
  title: FieldDefinitionText;
}

class TestModel2 extends Model {
  title: FieldDefinitionText;
  relSingle: FieldDefinitionRelation<{
    model: TestModel;
    multiple: false;
  }>;
  relMultiple: FieldDefinitionRelation<{
    model: TestModel;
    multiple: false;
  }>;
  obj: FieldDefinitionJSON<{
    nestedRelSingle: FieldDefinitionRelation<{
      model: TestModel;
      multiple: false;
    }>;
    nestedRelMultiple: FieldDefinitionRelation<{
      model: TestModel;
      multiple: true;
    }>;
  }>;
}

class TestModel3 extends Model {
  title: FieldDefinitionText;
  relSingle: FieldDefinitionRelation<{
    model: TestModel2;
    multiple: false;
  }>;
  relMultiple: FieldDefinitionRelation<{
    model: TestModel2;
    multiple: false;
  }>;
}

describe("ClientAdapter", () => {
  let model: typeof TestModel;
  let model2: typeof TestModel2;
  let model3: typeof TestModel3;

  beforeAll(async () => {
    model = await generateModel();
    model2 = await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      relSingle: {
        type: FieldTypes.RELATION,
        options: {
          ref: model.slug,
          multiple: false,
        },
      },
      relMultiple: {
        type: FieldTypes.RELATION,
        options: {
          ref: model.slug,
          multiple: true,
        },
      },
      obj: {
        type: FieldTypes.JSON,
        options: {
          fields: {
            nestedRelSingle: {
              type: FieldTypes.RELATION,
              options: {
                ref: model.slug,
                multiple: false,
              },
            },
            nestedRelMultiple: {
              type: FieldTypes.RELATION,
              options: {
                ref: model.slug,
                multiple: true,
              },
            },
          },
        },
      },
    });
    model3 = await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      relSingle: {
        type: FieldTypes.RELATION,
        options: {
          ref: model2.slug,
          multiple: false,
        },
      },
      relMultiple: {
        type: FieldTypes.RELATION,
        options: {
          ref: model2.slug,
          multiple: true,
        },
      },
    });
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

      const fetchWatcherPromise = fetchWatcher(model, created._id);

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

      const fetchWatcherPromiseFetch = fetchWatcher(model, created._id);
      const fetchWatcherPromiseLocalUpdate = fetchWatcher(
        model,
        created._id,
        "localUpdate"
      );

      await model.get({ filter: { _id: created._id } });

      await expect(fetchWatcherPromiseFetch).resolves.toBeTruthy();
      await expect(fetchWatcherPromiseLocalUpdate).resolves.toBeFalsy();
    });

    it("Model.get should emit localUpdate event on updaterSubject if upserted in instancesMap", async () => {
      const created = await model.create({ title: "title" });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(created._id);

      const fetchWatcherPromiseFetch = fetchWatcher(model, created._id);
      const fetchWatcherPromiseLocalUpdate = fetchWatcher(
        model,
        created._id,
        "localUpdate"
      );

      await model.get({ ids: [created._id] });

      await expect(fetchWatcherPromiseFetch).resolves.toBeTruthy();
      await expect(fetchWatcherPromiseLocalUpdate).resolves.toBeTruthy();
    });

    it("Model.get should be able to populate single relation", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      const fetched = await model2.get({
        ids: [instance2._id],
        populate: ["relSingle"],
      });

      expect(fetched.__doc.relSingle).toBe(instance1._id);
      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      await expect(fetched.relSingle).resolves.toBeInstanceOf(model);
    });

    it("Model.get with populate should emit fetch event on updaterSubject", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const fetchWatcherPromise = fetchWatcher(model, instance1._id);

      await model2.get({
        ids: [instance2._id],
        populate: ["relSingle"],
      });

      await expect(fetchWatcherPromise).resolves.toBeTruthy();
    });

    it("Model.get with populate should emit localUpdate event on updaterSubject if upserted in instancesMap", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);

      const fetchWatcherPromiseLocalUpdate = fetchWatcher(
        model,
        instance1._id,
        "localUpdate"
      );

      await model2.get({
        ids: [instance2._id],
        populate: ["relSingle"],
      });

      await expect(fetchWatcherPromiseLocalUpdate).resolves.toBeTruthy();
    });

    it("Model.get should be able to populate multiple relation", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model.create({
        title: generateRandomString(),
      });

      const instance3 = await model2.create({
        title: generateRandomString(),
        relMultiple: [instance1._id, instance2._id],
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter.instancesMap.delete(instance2._id);
      const fetched = await model2.get({
        ids: [instance3._id],
        populate: ["relMultiple"],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.relMultiple).toEqual([instance1._id, instance2._id]);

      await expect(fetched.relMultiple).resolves.toBeInstanceOf(ModelList);
      await expect(fetched.relMultiple).resolves.toHaveProperty("length", 2);
      await expect(fetched.relMultiple).resolves.toHaveProperty("count", 2);
    });

    it("Model.get should be able to populate single relation within json", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        obj: {
          nestedRelSingle: instance1._id,
        },
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      const fetched = await model2.get({
        ids: [instance2._id],
        populate: ["obj.nestedRelSingle"],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();

      expect(fetched.__doc.obj).toEqual({ nestedRelSingle: instance1._id });
      await expect(fetched.obj.nestedRelSingle).resolves.toBeInstanceOf(model);
    });

    it("Model.get should be able to populate multiple relation within json", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model.create({
        title: generateRandomString(),
      });

      const instance3 = await model2.create({
        title: generateRandomString(),
        obj: {
          nestedRelMultiple: [instance1._id, instance2._id],
        },
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter.instancesMap.delete(instance2._id);
      const fetched = await model2.get({
        ids: [instance3._id],
        populate: ["obj.nestedRelMultiple"],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.obj).toEqual({
        nestedRelMultiple: [instance1._id, instance2._id],
      });
      expect(fetched.__doc.obj.nestedRelMultiple).toEqual([
        instance1._id,
        instance2._id,
      ]);

      const obj = fetched.obj;

      await expect(obj.nestedRelMultiple).resolves.toBeInstanceOf(ModelList);
      await expect(obj.nestedRelMultiple).resolves.toHaveProperty("length", 2);
      await expect(obj.nestedRelMultiple).resolves.toHaveProperty("count", 2);
    });

    it("Model.get should be able to populate nested single relations", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const instance3 = await model3.create({
        title: generateRandomString(),
        relSingle: instance2._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      const adapter2 = model2.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter2.instancesMap.delete(instance2._id);
      const fetched = await model3.get({
        ids: [instance3._id],
        populate: [{ path: "relSingle", populate: ["relSingle"] }],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter2.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.relSingle).toEqual(instance2._id);
      await expect(fetched.relSingle).resolves.toBeInstanceOf(model2);

      const instance2FromMap = adapter2.instancesMap.get(instance2._id);
      expect(instance2FromMap.__doc.relSingle).toEqual(instance1._id);
    });

    it("Model.get with populate on nested single relations should emit localUpdate event on updaterSubject if upserted in instancesMap", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const instance3 = await model3.create({
        title: generateRandomString(),
        relSingle: instance2._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      const adapter2 = model2.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter2.instancesMap.delete(instance2._id);

      const fetchWatcherPromiseLocalUpdate1 = fetchWatcher(
        model,
        instance1._id,
        "localUpdate"
      );
      const fetchWatcherPromiseLocalUpdate2 = fetchWatcher(
        model2,
        instance2._id,
        "localUpdate"
      );

      const fetched = await model3.get({
        ids: [instance3._id],
        populate: [{ path: "relSingle", populate: ["relSingle"] }],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter2.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.relSingle).toEqual(instance2._id);
      await expect(fetched.relSingle).resolves.toBeInstanceOf(model2);

      const instance2FromMap = adapter2.instancesMap.get(instance2._id);
      expect(instance2FromMap.__doc.relSingle).toEqual(instance1._id);

      await expect(fetchWatcherPromiseLocalUpdate1).resolves.toBeTruthy();
      await expect(fetchWatcherPromiseLocalUpdate2).resolves.toBeTruthy();
    });

    it("Model.get with populate on nested single relations should not emit localUpdate event on updaterSubject if fetched documents are not upserted in instancesMap", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const instance3 = await model3.create({
        title: generateRandomString(),
        relSingle: instance2._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      const adapter2 = model2.__adapter as ClientAdapter;

      const fetchWatcherPromiseLocalUpdate1 = fetchWatcher(
        model,
        instance1._id,
        "localUpdate"
      );
      const fetchWatcherPromiseLocalUpdate2 = fetchWatcher(
        model2,
        instance2._id,
        "localUpdate"
      );

      const fetched = await model3.get({
        ids: [instance3._id],
        populate: [{ path: "relSingle", populate: ["relSingle"] }],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter2.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.relSingle).toEqual(instance2._id);
      await expect(fetched.relSingle).resolves.toBeInstanceOf(model2);

      const instance2FromMap = adapter2.instancesMap.get(instance2._id);
      expect(instance2FromMap.__doc.relSingle).toEqual(instance1._id);

      await expect(fetchWatcherPromiseLocalUpdate1).resolves.toBeFalsy();
      await expect(fetchWatcherPromiseLocalUpdate2).resolves.toBeFalsy();
    });

    it("Model.get should be able to populate nested multiple relations", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relMultiple: [instance1._id],
      });

      const instance3 = await model3.create({
        title: generateRandomString(),
        relMultiple: [instance2._id],
      });

      const adapter = model.__adapter as ClientAdapter;
      const adapter2 = model2.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter2.instancesMap.delete(instance2._id);
      const fetched = await model3.get({
        ids: [instance3._id],
        populate: [{ path: "relMultiple", populate: ["relMultiple"] }],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter2.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched.__doc.relMultiple).toEqual([instance2._id]);

      // now should be able to get instance1 without fetching it
      const fetchWatcherPromise = fetchWatcher(model, instance1._id);

      const fetchedInstance1 = await model.get({
        ids: [instance1._id],
      });

      expect(fetchedInstance1).toBeInstanceOf(model);
      expect(fetchedInstance1._id).toEqual(instance1._id);

      await expect(fetchWatcherPromise).resolves.toBeFalsy();
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

      const fetchWatcherPromise = fetchWatcher(model, created1._id);

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

      let fetchWatcherPromise1 = fetchWatcher(model, created1._id);
      let fetchWatcherPromise2 = fetchWatcher(model, created2._id);

      const adapter = model.__adapter as ClientAdapter;
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

      const adapter = model.__adapter as ClientAdapter;
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

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(createdList[0]._id);
      adapter.instancesMap.delete(createdList[2]._id);
      adapter.instancesMap.delete(createdList[3]._id);
      adapter.instancesMap.delete(createdList[7]._id);

      const fetchWatcherPromise = fetchWatcher(model, createdList[1]._id);

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

      const fetchWatcherPromise = fetchWatcher(model, createdList[0]._id);

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

    it("Model.getList should be able to populate single relation", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model2.create({
        title: generateRandomString(),
        relSingle: instance1._id,
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      const fetched = await model2.getList({
        ids: [instance2._id],
        populate: ["relSingle"],
      });

      expect(fetched.length).toBe(1);
      expect(fetched[0].__doc.relSingle).toBe(instance1._id);
      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      await expect(fetched[0].relSingle).resolves.toBeInstanceOf(model);
    });

    it("Model.getList should be able to populate multiple relation", async () => {
      const instance1 = await model.create({
        title: generateRandomString(),
      });

      const instance2 = await model.create({
        title: generateRandomString(),
      });

      const instance3 = await model2.create({
        title: generateRandomString(),
        relMultiple: [instance1._id, instance2._id],
      });

      const adapter = model.__adapter as ClientAdapter;
      adapter.instancesMap.delete(instance1._id);
      adapter.instancesMap.delete(instance2._id);
      const fetched = await model2.getList({
        ids: [instance3._id],
        populate: ["relMultiple"],
      });

      expect(adapter.instancesMap.has(instance1._id)).toBeTruthy();
      expect(adapter.instancesMap.has(instance2._id)).toBeTruthy();

      expect(fetched[0].__doc.relMultiple).toEqual([
        instance1._id,
        instance2._id,
      ]);

      await expect(fetched[0].relMultiple).resolves.toBeInstanceOf(ModelList);
      await expect(fetched[0].relMultiple).resolves.toHaveProperty("length", 2);
      await expect(fetched[0].relMultiple).resolves.toHaveProperty("count", 2);
    });
  });
});
