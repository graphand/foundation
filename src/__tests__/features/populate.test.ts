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

describe("test populate", () => {
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

  it("Model.get should be able to populate single relation", async () => {
    const instance1 = await model.create({
      title: generateRandomString(),
    });

    const instance2 = await model2.create({
      title: generateRandomString(),
      relSingle: instance1._id,
    });

    const adapter = model.getAdapter() as ClientAdapter;
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

    model.clearCache();

    const fetchWatcherPromise = fetchWatcher(model, { _id: instance1._id });

    await model2.get({
      ids: [instance2._id],
      populate: ["relSingle"],
    });

    await expect(fetchWatcherPromise).resolves.toBeTruthy();
  });

  it("Model.get with populate should emit fetch event on updaterSubject if upserted in instancesMap", async () => {
    const instance1 = await model.create({
      title: generateRandomString(),
    });

    const instance2 = await model2.create({
      title: generateRandomString(),
      relSingle: instance1._id,
    });

    const adapter = model.getAdapter() as ClientAdapter;
    adapter.instancesMap.delete(instance1._id);

    const fetchWatcherPromiseLocalUpdate = fetchWatcher(model, {
      _id: instance1._id,
      operation: "fetch",
    });

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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;
    adapter.instancesMap.delete(instance1._id);
    adapter.instancesMap.delete(instance2._id);
    adapter2.instancesMap.delete(instance3._id);
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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;
    adapter.instancesMap.delete(instance1._id);
    adapter2.instancesMap.delete(instance2._id);
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

    const adapter = model.getAdapter() as ClientAdapter;
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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;
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

  it("Model.get with populate on nested single relations should emit fetch event on updaterSubject if upserted in instancesMap", async () => {
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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;
    adapter.instancesMap.delete(instance1._id);
    adapter2.instancesMap.delete(instance2._id);

    const fetchWatcherPromiseLocalUpdate1 = fetchWatcher(model, {
      _id: instance1._id,
      operation: "fetch",
    });
    const fetchWatcherPromiseLocalUpdate2 = fetchWatcher(model2, {
      _id: instance2._id,
      operation: "fetch",
    });

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

  it("Model.get with populate on nested single relations should not emit fetch event on updaterSubject if fetched documents are not upserted in instancesMap", async () => {
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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;

    const fetchWatcherPromiseLocalUpdate1 = fetchWatcher(model, {
      _id: instance1._id,
      operation: "fetch",
    });
    const fetchWatcherPromiseLocalUpdate2 = fetchWatcher(model2, {
      _id: instance2._id,
      operation: "fetch",
    });

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

    const adapter = model.getAdapter() as ClientAdapter;
    const adapter2 = model2.getAdapter() as ClientAdapter;
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
    const fetchWatcherPromise = fetchWatcher(model, { _id: instance1._id });

    const fetchedInstance1 = await model.get({
      ids: [instance1._id],
    });

    expect(fetchedInstance1).toBeInstanceOf(model);
    expect(fetchedInstance1._id).toEqual(instance1._id);

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

    const adapter = model.getAdapter() as ClientAdapter;
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

    const adapter = model.getAdapter() as ClientAdapter;
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

  it("should be able to populate within complex schema", async () => {
    const _model1 = await generateModel();

    const _model2 = await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      relSingle: {
        type: FieldTypes.RELATION,
        options: {
          ref: _model1.slug,
        },
      },
      relMultiple: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.RELATION,
            options: {
              ref: _model1.slug,
            },
          },
        },
      },
      obj: {
        type: FieldTypes.NESTED,
        options: {
          fields: {
            relSingle: {
              type: FieldTypes.RELATION,
              options: {
                ref: _model1.slug,
              },
            },
            relMultiple: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: _model1.slug,
                  },
                },
              },
            },
          },
        },
      },
    });

    const _model3 = await generateModel(undefined, {
      title: {
        type: FieldTypes.TEXT,
      },
      arr: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.NESTED,
                options: {
                  fields: {
                    nested: {
                      type: FieldTypes.NESTED,
                      options: {
                        fields: {
                          relSingle: {
                            type: FieldTypes.RELATION,
                            options: {
                              ref: _model2.slug,
                            },
                          },
                          relMultiple: {
                            type: FieldTypes.ARRAY,
                            options: {
                              items: {
                                type: FieldTypes.RELATION,
                                options: {
                                  ref: _model2.slug,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const created1 = await _model1.createMultiple(
      Array.from({ length: 3 }, () => ({
        title: generateRandomString(),
      }))
    );

    const created2 = await _model2.createMultiple(
      Array.from({ length: 3 }, (v, k: number) => ({
        title: generateRandomString(),
        relMultiple: created1.map((i) => i._id),
        relSingle: created1[0]._id,
        obj: {
          relMultiple: created1.map((i) => i._id),
          relSingle: created1[k]._id,
        },
      }))
    );

    const created2Ids = created2.map((i) => i._id);

    const created3 = await _model3.createMultiple(
      Array.from({ length: 3 }, () => ({
        title: generateRandomString(),
        arr: [
          [
            {
              nested: {
                relMultiple: created2Ids,
                relSingle: created2[0]._id,
              },
            },
            {
              nested: {
                relMultiple: created2Ids,
                relSingle: created2[1]._id,
              },
            },
          ],
          [
            {
              nested: {
                relMultiple: [...created2Ids].reverse(),
                relSingle: created2[1]._id,
              },
            },
            {
              nested: {
                relMultiple: [...created2Ids].reverse(),
                relSingle: created2[2]._id,
              },
            },
          ],
        ],
      }))
    );

    const instancesMap1 = (_model1.getAdapter() as ClientAdapter).instancesMap;
    const instancesMap2 = (_model2.getAdapter() as ClientAdapter).instancesMap;
    const instancesMap3 = (_model3.getAdapter() as ClientAdapter).instancesMap;

    instancesMap1.clear();
    instancesMap2.clear();
    instancesMap3.clear();

    await _model3.getList({
      ids: created3.map((i) => i._id),
      populate: [
        {
          path: "arr.[].nested.relSingle",
          populate: ["obj.relSingle"],
        },
        {
          path: "arr.[].nested.relMultiple",
          populate: ["relSingle", "obj.relMultiple"],
        },
      ],
    });

    expect(instancesMap2.has(created2[0]._id)).toBeTruthy();
    expect(instancesMap2.has(created2[1]._id)).toBeTruthy();
    expect(instancesMap1.has(created1[0]._id)).toBeTruthy();
    expect(instancesMap1.has(created1[1]._id)).toBeTruthy();
    expect(instancesMap1.has(created1[2]._id)).toBeTruthy();
  });
});
