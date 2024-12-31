import { vi } from "vitest";
import { mockAdapter, mockModel, generateRandomString } from "@/lib/test-utils.dev.js";
import { Field } from "@/lib/field.js";
import { Model } from "@/lib/model.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Validator } from "@/lib/validator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Account } from "@/models/account.js";
import { CoreError } from "@/lib/core-error.js";
import { DataModel } from "@/models/data-model.js";
import { ErrorCodes } from "@/enums/error-codes.js";
import { Media } from "@/models/media.js";
import { ModelDefinition, ModelInstance, SerializerFieldsMap } from "@/types/index.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { faker } from "@faker-js/faker";
import { Adapter } from "@/lib/adapter.js";
import { ObjectId } from "bson";

describe("Test Model", () => {
  const BaseModel = mockModel({
    fields: {
      title: {
        type: FieldTypes.TEXT,
      },
    },
    validators: [
      {
        type: ValidatorTypes.SAMPLE,
        options: {
          field: "title",
        },
      },
    ],
  });

  describe("Model crud", () => {
    it("should be able to Model.create", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const created = await TestModel.create({});
      expect(created).toBeInstanceOf(TestModel);
    });

    it("should be able to Model.createMultiple", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const created = await TestModel.createMultiple([{}, {}, {}]);
      expect(created).toBeInstanceOf(Array);
      created.forEach(i => {
        expect(i).toBeInstanceOf(TestModel);
      });
    });

    it("should be able to Model.count", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const count = await TestModel.count();
      expect(typeof count).toBe("number");
    });

    it("should be able to Model.count", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const count = await TestModel.count();
      expect(typeof count).toBe("number");
    });
  });

  describe("Model initialization", () => {
    it("should be able to manually define fields", () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
            options: {},
          },
        },
      }).extend({ adapterClass: adapter });

      expect(model.fieldsKeys).toContain("title");
    });

    it("Model should load fields from adapter", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const created = await TestModel.create({});
      expect(created.model().fieldsMap.get("title")).toBeInstanceOf(Field);
    });

    it("Model should load validators from adapter", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const created = await TestModel.create({});
      expect(created.model().validatorsArray).toBeInstanceOf(Array);
      expect(created.model().validatorsArray.length).toEqual(1);
    });

    it("should be able to getClass with adapter", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const AccountModel = TestModel.getClass("accounts");
      expect(AccountModel.getAdapter(false)).toBeInstanceOf(adapter);
    });

    it("should be able to getClass without adapter", async () => {
      const AccountModel = Model.getClass("accounts");
      expect(AccountModel.getAdapter(false)).toBeUndefined();
    });

    it("Model initialization should execute hooks", async () => {
      const adapter = mockAdapter();
      const _model = mockModel();
      const model = _model.extend({ adapterClass: adapter });

      const hookBefore = vi.fn();
      const hookAfter = vi.fn();
      model.hook("before", "initialize", hookBefore);
      model.hook("after", "initialize", hookAfter);

      await model.initialize();

      expect(hookBefore).toBeCalledTimes(1);
      expect(hookAfter).toBeCalledTimes(1);
    });

    it("Model initialization should execute hooks only at first initialization", async () => {
      const adapter = mockAdapter();
      const _model = mockModel();
      const model = _model.extend({ adapterClass: adapter });

      const hookBefore = vi.fn();
      const hookAfter = vi.fn();
      model.hook("before", "initialize", hookBefore);
      model.hook("after", "initialize", hookAfter);

      await model.initialize();

      expect(hookBefore).toBeCalledTimes(1);
      expect(hookAfter).toBeCalledTimes(1);

      await model.initialize();

      expect(hookBefore).toBeCalledTimes(1);
      expect(hookAfter).toBeCalledTimes(1);
    });

    it("Model initialization with hook error should throw error", async () => {
      const adapter = mockAdapter();
      const _model = mockModel();
      const model = _model.extend({ adapterClass: adapter });

      const hookBefore = vi.fn(() => {
        throw new Error("test");
      });
      model.hook("before", "initialize", hookBefore);

      await expect(model.initialize()).rejects.toThrowError("test");
    });

    it("Model initialization should use initOptions", async () => {
      const adapter = mockAdapter();
      const base = class extends Model {
        static slug = generateRandomString();
        static extensible: boolean = true;
      };

      const model = base.extend({ adapterClass: adapter });

      const initFn = vi.spyOn(model, "reloadModel");

      expect(initFn).toBeCalledTimes(0);

      await model.initialize();

      expect(initFn).toBeCalledTimes(1);

      await model.initialize();

      expect(initFn).toBeCalledTimes(1);

      const lastCallArgs = initFn.mock.calls?.[0]?.[0];

      expect(lastCallArgs?.datamodel).toBeUndefined();
      expect(lastCallArgs?.ctx).toBeUndefined();

      const model2 = model.extend({
        initOptions: {
          datamodel: DataModel.hydrate({
            definition: {
              keyField: "test",
            },
          }),
        },
        adapterClass: mockAdapter(),
      });

      const initFn2 = vi.spyOn(model2, "reloadModel");

      expect(initFn2).toBeCalledTimes(0);

      await model2.initialize();

      expect(initFn2).toBeCalledTimes(1);

      const lastCall2Args = initFn2.mock.calls?.[0]?.[0];

      expect(lastCall2Args?.datamodel).toBeInstanceOf(DataModel);

      expect(model.getKeyField()).toEqual("_id");
      expect(model2.getKeyField()).toEqual("test");
    });

    // it("Model clone should override fields", async () => {
    //   const adapter = mockAdapter();
    //   const model = class extends Data {
    //     static slug = "test";
    //     static definition: ModelDefinition = {
    //       fields: {
    //         test: {
    //           type: FieldTypes.TEXT,
    //         },
    //       },
    //     };
    //   }.extend({ adapterClass: adapter });

    //   const fieldTest = model.fieldsMap.get("test");
    //   expect(fieldTest).toBeInstanceOf(Field);
    //   expect(fieldTest.type).toEqual(FieldTypes.TEXT);

    //   const dm = await DataModel.extend({ adapterClass: adapter }).create({
    //     slug: "test",
    //     definition: {
    //       fields: {
    //         test: {
    //           type: FieldTypes.NUMBER,
    //         },
    //         test2: {
    //           type: FieldTypes.TEXT,
    //         },
    //       },
    //     },
    //   });

    //   const model2 = model.extend({
    //     initOptions: {
    //       datamodel: dm,
    //     },
    //     adapterClass: mockAdapter(),
    //   });

    //   await model2.initialize();

    //   expect(model2.fieldsMap?.get("test2")).toBeInstanceOf(Field);
    //   const fieldTest2 = model2.fieldsMap.get("test");
    //   expect(fieldTest2).toBeInstanceOf(Field);
    //   expect(fieldTest2.type).toEqual(FieldTypes.NUMBER);
    // });

    it("Model.keyField is not overriden by datamodel if declared in inherited class", async () => {
      const adapter = mockAdapter();
      const slug1 = generateRandomString();
      const slug2 = generateRandomString();
      const model = class extends Model {
        static slug = slug1;
        static connectable = true;
        static extensible = true;
        static isEnvironmentScoped = true;
        static definition: ModelDefinition = {
          keyField: "test",
        };
      }.extend({ adapterClass: adapter });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: slug2,
        definition: {
          keyField: "test2",
          fields: {
            test2: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const model2 = class extends model {
        static slug = slug2;
        static connectable = true;
        static extensible = true;
        static isEnvironmentScoped = true;
      }.extend({ adapterClass: adapter });

      await model2.initialize();

      expect(model2.getKeyField()).toEqual("test");
    });

    it("Medias keyField is not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.slug,
        definition: {
          keyField: "test2",
          fields: {
            test2: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.fieldsMap.get("test2")).toBeInstanceOf(Field);
      expect(model.getKeyField()).toEqual("name");
    });

    it("Medias singularity is not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.slug,
        definition: {
          single: true,
          fields: {
            test2: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.fieldsMap.get("test2")).toBeInstanceOf(Field);
      expect(model.isSingle()).toBe(false);
    });

    it("Medias base fields are not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.slug,
        definition: {
          single: true,
          fields: {
            name: {
              type: FieldTypes.NUMBER,
            },
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.fieldsMap.get("name")).toBeInstanceOf(Field);
      expect(model.fieldsMap.get("name")?.type).toBe(FieldTypes.TEXT);
    });
  });

  describe("Model getter", () => {
    it("Model should return field default value if undefined", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.TEXT,
            options: {
              default: "default",
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({});
      expect(created.get("test")).toBe("default");
    });

    it("should serialize with field from adapter", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: 123 as unknown as string,
      });

      expect(created.get("test")).toBe("123");
    });

    it("should serialize with nested fields in json", async () => {
      const adapter = mockAdapter();
      const _model = mockModel({
        fields: {
          test: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                nested: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        },
      });
      const model = _model.extend({ adapterClass: adapter });

      const created = await model.create<
        typeof Model & {
          definition: {
            fields: {
              test: {
                type: FieldTypes.OBJECT;
                options: {
                  fields: {
                    nested: {
                      type: FieldTypes.TEXT;
                    };
                  };
                };
              };
            };
          };
        }
      >({
        test: {
          nested: 123 as unknown as string,
        },
      });

      expect(created.get("test.nested")).toBe("123");
      expect(created.test?.nested).toBe("123");
    });

    it("should serialize with nested fields in array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: [123 as unknown as string],
      });

      expect(created.get("test")).toEqual(["123"]);
      expect(created.get("test.[]")).toEqual(["123"]);
      expect(created.get("test.toto")).toEqual(undefined);
      expect(created.test).toBeInstanceOf(Array);
      expect(created.test?.length).toEqual(1);
      expect(created.test?.[0]).toEqual("123");
    });

    it("should serialize with nested fields in array of array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: [[123 as unknown as string], [456 as unknown as string]],
      });

      expect(created.get("test")).toEqual([["123"], ["456"]]);
      expect(created.get("test.[]")).toEqual([["123"], ["456"]]);
    });

    it("should serialize with nested json field in array of array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        nested: {
                          type: FieldTypes.TEXT,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: [
          [
            {
              nested: 123 as unknown as string,
            },
            {
              nested: 456 as unknown as string,
            },
          ],
          [
            {
              nested: 123 as unknown as string,
            },
            {
              nested: 456 as unknown as string,
            },
          ],
        ],
      });

      expect(created.get("test")).toEqual([
        [
          {
            nested: "123",
          },
          {
            nested: "456",
          },
        ],
        [
          {
            nested: "123",
          },
          {
            nested: "456",
          },
        ],
      ]);

      expect(created.get("test.[]")).toEqual([
        [
          {
            nested: "123",
          },
          {
            nested: "456",
          },
        ],
        [
          {
            nested: "123",
          },
          {
            nested: "456",
          },
        ],
      ]);

      expect(created.get("test.nested")).toEqual(undefined);

      expect(created.get("test.[].nested")).toEqual([
        ["123", "456"],
        ["123", "456"],
      ]);

      expect(created.get("test.[].[].nested")).toEqual([
        ["123", "456"],
        ["123", "456"],
      ]);

      expect(created.get("test.[].[].nested.[]")).toEqual(undefined);
    });

    it("should serialize with nested fields in array of json", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    nested: {
                      type: FieldTypes.TEXT,
                    },
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: [
          {
            nested: 123 as unknown as string,
          },
          {
            nested: 456 as unknown as string,
          },
        ],
      });

      expect(created.get("test")).toEqual([
        {
          nested: "123",
        },
        {
          nested: "456",
        },
      ]);

      expect(created.get("test.[]")).toEqual([
        {
          nested: "123",
        },
        {
          nested: "456",
        },
      ]);

      expect(created.get("test.nested")).toEqual(["123", "456"]);

      expect(created.get("test.[].nested")).toEqual(["123", "456"]);

      expect(created.get("test.nested.undefined")).toEqual(undefined);
    });

    it("should serialize with complex schema fields", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          field1: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    field2: {
                      type: FieldTypes.TEXT,
                    },
                    field3: {
                      type: FieldTypes.ARRAY,
                      options: {
                        items: {
                          type: FieldTypes.OBJECT,
                          options: {
                            fields: {
                              field4: {
                                type: FieldTypes.TEXT,
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
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        field1: [
          {
            field2: "test1",
            field3: [
              {
                field4: "test1.1",
              },
              {
                field4: "test1.2",
              },
            ],
          },
          {
            field2: "test2",
            field3: [
              {
                field4: "test2.1",
              },
              {
                field4: "test2.2",
              },
            ],
          },
        ],
      });

      expect(created.get("field1")).toEqual([
        {
          field2: "test1",
          field3: [
            {
              field4: "test1.1",
            },
            {
              field4: "test1.2",
            },
          ],
        },
        {
          field2: "test2",
          field3: [
            {
              field4: "test2.1",
            },
            {
              field4: "test2.2",
            },
          ],
        },
      ]);

      expect(created.get("field1.field2")).toEqual(["test1", "test2"]);
      expect(created.get("field1.[].field2")).toEqual(["test1", "test2"]);
      expect(created.get("field1.field3")).toEqual([
        [
          {
            field4: "test1.1",
          },
          {
            field4: "test1.2",
          },
        ],
        [
          {
            field4: "test2.1",
          },
          {
            field4: "test2.2",
          },
        ],
      ]);

      expect(created.get("field1.field3.field4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("field1.[].field3.field4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("field1.[].field3.[].field4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("field1.[].field3.[].field4.undefined")).toEqual(undefined);
    });

    it("should serialize array of relation to PromiseModelList", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.RELATION,
                options: {
                  ref: "accounts",
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: ["63fdefb5debe7dae686d3575", "63fdefb5debe7dae686d3575"],
      });

      expect(created.get("test")).toBeInstanceOf(PromiseModelList);
    });

    it("should serialize array of relation to PromiseModelList even if json nested", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          arr: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    arrRel: {
                      type: FieldTypes.ARRAY,
                      options: {
                        items: {
                          type: FieldTypes.RELATION,
                          options: {
                            ref: "accounts",
                          },
                        },
                      },
                    },
                    rel: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: "accounts",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        arr: [
          {
            arrRel: ["63fdefb5debe7dae686d3575", "63fdefb5debe7dae686d3575"],
            rel: "63fdefb5debe7dae686d3575",
          },
          {
            arrRel: ["63fdefb5debe7dae686d3575", "63fdefb5debe7dae686d3575"],
            rel: "63fdefb5debe7dae686d3575",
          },
        ],
      });

      expect(created.get("arr")).toBeInstanceOf(Array);

      const rels = created.get("arr.rel") as any;
      expect(rels).toBeInstanceOf(Array);
      expect(rels.every((r: unknown) => r instanceof PromiseModel)).toBeTruthy();

      const arrRels = created.get("arr.arrRel") as any;
      expect(arrRels).toBeInstanceOf(Array);
      expect(arrRels.every((r: unknown) => r instanceof PromiseModelList)).toBeTruthy();
    });

    it("should serialize to undefined nested fields of null", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                test: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({});

      expect(created.get("test.test")).toBe(undefined);
    });

    it("should serialize to undefined nested fields of null array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {
          test: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    test: {
                      type: FieldTypes.TEXT,
                    },
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({ test: [] });

      expect(created.get("test.test")).toEqual([]);
      expect(created.get("test.test2")).toEqual([]);
    });

    it("should serialize to undefined nested fields of nested unexisting field", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        fields: {},
      }).extend({ adapterClass: adapter });

      const created = await model.create({});

      expect(created.get("obj")).toEqual(undefined);
    });

    it("should not call useless serializer", async () => {
      const serializeText = vi.fn(value => value);

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
            serialize = serializeText;
          },
        },
      });

      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                field1: {
                  type: FieldTypes.TEXT,
                },
                field2: {
                  type: FieldTypes.TEXT,
                },
                field3: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        },
      }).extend({ adapterClass: _adapter });

      const created = await model.create({
        obj: {
          field1: "test1",
          field2: "test2",
          field3: "test3",
        },
      });

      expect(serializeText).toBeCalledTimes(0);

      created.get("obj.field1");

      expect(serializeText).toBeCalledTimes(1);
    });
  });

  describe("Model getter and setter should be consistant", () => {
    const adapter = mockAdapter();
    const model = mockModel({
      fields: {
        text: {
          type: FieldTypes.TEXT,
        },
        obj: {
          type: FieldTypes.OBJECT,
          options: {
            fields: {
              nested: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
        relSingle: {
          type: FieldTypes.RELATION,
          options: {
            ref: "accounts",
          },
        },
        relArray: {
          type: FieldTypes.ARRAY,
          options: {
            items: {
              type: FieldTypes.RELATION,
              options: {
                ref: "accounts",
              },
            },
          },
        },
        arrOfText: {
          type: FieldTypes.ARRAY,
          options: {
            items: {
              type: FieldTypes.TEXT,
            },
          },
        },
        complex: {
          type: FieldTypes.OBJECT,
          options: {
            fields: {
              nestedArr: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        nested: {
                          type: FieldTypes.TEXT,
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
    }).extend({ adapterClass: adapter });

    const _testWith = async (opts: {
      field: string;
      value: unknown;
      create?: Record<string, unknown>;
      format?: keyof SerializerFieldsMap;
      primitive?: boolean;
    }) => {
      const { field, value, primitive } = opts;
      let { create, format } = opts;

      format ??= "json";
      create ??= { [field]: value };
      const created = await model.create(create);
      const v = created.get(field);

      const data = { ...(created.getData() as any) };
      data[field] = v;
      created.setData(data);

      const v2 = created.get(field, format);
      if (primitive) {
        expect(String(v2)).toEqual(String(value));
      } else {
        expect(v2).toEqual(value);
      }
    };

    describe("json", () => {
      it("with simple text field", async () => {
        await _testWith({ field: "text", value: "test" });
      });

      it("with array of text field", async () => {
        await _testWith({ field: "arrOfText", value: ["test1", "test2"] });
      });

      it("with json field", async () => {
        await _testWith({ field: "obj", value: { nested: "test" } });
      });

      it("with json field nested", async () => {
        await _testWith({
          field: "obj.nested",
          value: "test",
          create: {
            obj: { nested: "test" },
          },
        });
      });

      it("with relation field", async () => {
        await _testWith({ field: "relSingle", value: "507f191e810c19729de860ea" });
      });

      it("with array of relation field", async () => {
        await _testWith({
          field: "relArray",
          value: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
        });
      });

      it("with complex nested fields", async () => {
        await _testWith({
          field: "complex",
          value: {
            nestedArr: [],
          },
        });

        await _testWith({
          field: "complex.nestedArr",
          value: [],
          create: {
            complex: {
              nestedArr: [],
            },
          },
        });

        const created = await model.create({
          complex: {
            nestedArr: [
              {
                nested: "test1",
              },
              {
                nested: "test2",
              },
            ],
          },
        });

        expect(created.get("complex.nestedArr.nested")).toEqual(["test1", "test2"]);
      });
    });

    describe("object", () => {
      it("with simple text field", async () => {
        await _testWith({ field: "text", value: "test", format: "object" });
      });

      it("with relation field", async () => {
        await _testWith({ field: "relSingle", value: "507f191e810c19729de860ea", format: "object", primitive: true });
      });

      it("with array of relation field", async () => {
        await _testWith({
          field: "relArray",
          value: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
          format: "object",
          primitive: true,
        });
      });
    });
  });

  describe("Model validation", () => {
    it("Model should have keyField validator if keyField is defined", async () => {
      const adapter = mockAdapter();
      const BaseModelWithKeyField = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      });
      Object.assign(BaseModelWithKeyField.definition, { keyField: "title" });
      const TestModel = BaseModelWithKeyField.extend({ adapterClass: adapter });

      const keyFieldValidator = TestModel.validatorsArray.find(v => v?.type === ValidatorTypes.KEY_FIELD);
      expect(keyFieldValidator).toBeDefined();
    });

    it("Model should have keyField validator if keyField is defined and should filter unique and required validators", async () => {
      const adapter = mockAdapter();
      const BaseModelWithKeyField = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
        validators: [
          { type: ValidatorTypes.UNIQUE, options: { field: "title" } },
          { type: ValidatorTypes.REQUIRED, options: { field: "title" } },
        ],
      });
      Object.assign(BaseModelWithKeyField.definition, { keyField: "title" });
      const TestModel = BaseModelWithKeyField.extend({ adapterClass: adapter });

      const validators = TestModel.validatorsArray;

      const keyFieldValidator = validators.find(v => v?.type === ValidatorTypes.KEY_FIELD);
      const uniqueValidator = validators.find(v => v?.type === ValidatorTypes.UNIQUE);
      const requiredValidator = validators.find(v => v?.type === ValidatorTypes.REQUIRED);

      expect(keyFieldValidator).toBeDefined();
      expect(uniqueValidator).toBeUndefined();
      expect(requiredValidator).toBeUndefined();
    });

    it("Model should validate with validator from adapter", async () => {
      const testValidate = vi.fn(() => Promise.resolve(true));

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });
      await TestModel.initialize();
      const i = TestModel.hydrate({});
      expect(testValidate).toHaveBeenCalledTimes(0);

      await TestModel.validate([i.getData()]);

      expect(testValidate).toHaveBeenCalledTimes(1);
    });

    it("Model should throw error with validator returning false", async () => {
      const testValidate = vi.fn(() => Promise.resolve(false));

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });
      await TestModel.initialize();
      const i = TestModel.hydrate({});

      expect.assertions(1);

      try {
        await TestModel.validate([i.getData()]);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("Model should validate with field from adapter", async () => {
      const testValidate = vi.fn(() => Promise.resolve(true));

      class TestFieldText extends Field<FieldTypes.TEXT> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: TestFieldText,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });
      await TestModel.initialize();
      const i = TestModel.hydrate({});
      expect(testValidate).toHaveBeenCalledTimes(0);

      await TestModel.validate([i.getData()]);

      expect(testValidate).toHaveBeenCalledTimes(1);
    });

    it("Model should throw error with field validator returning false", async () => {
      const testValidate = vi.fn(() => Promise.resolve(false));

      class TestFieldText extends Field<FieldTypes.TEXT> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: TestFieldText,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });
      await TestModel.initialize();
      const i = TestModel.hydrate({});

      expect.assertions(1);

      try {
        await TestModel.validate([i.getData()]);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("Model should validate validators & fields on create", async () => {
      const testValidateField = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestFieldText extends Field<FieldTypes.TEXT> {
        validate = testValidateField;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: TestFieldText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateField).toHaveBeenCalledTimes(0);
      expect(testValidateValidator).toHaveBeenCalledTimes(0);

      await TestModel.create({});

      expect(testValidateField).toHaveBeenCalledTimes(1);
      expect(testValidateValidator).toHaveBeenCalledTimes(1);
    });

    it("Model should validate validators & fields once by value on createMultiple", async () => {
      const testValidateField = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestFieldText extends Field<FieldTypes.TEXT> {
        validate = testValidateField;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: TestFieldText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateField).toHaveBeenCalledTimes(0);
      expect(testValidateValidator).toHaveBeenCalledTimes(0);

      await TestModel.createMultiple([{}, {}, {}]);

      expect(testValidateField).toHaveBeenCalledTimes(1);
      expect(testValidateValidator).toHaveBeenCalledTimes(1);
    });

    it("Model should validate validators & fields once on createMultiple", async () => {
      const testValidateField = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestFieldText extends Field<FieldTypes.TEXT> {
        validate = testValidateField;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        fieldsMap: {
          [FieldTypes.TEXT]: TestFieldText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateField).toHaveBeenCalledTimes(0);
      expect(testValidateValidator).toHaveBeenCalledTimes(0);

      await TestModel.createMultiple([
        {
          title: "title",
        },
        {
          title: "title",
        },
        {
          title: "title_bis",
        },
      ]);

      expect(testValidateField).toHaveBeenCalledTimes(1);
      expect(testValidateValidator).toHaveBeenCalledTimes(1);
    });
  });

  describe("Model hooks", () => {
    it("should be able to hook", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });

      const beforeCreateFn = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn);
      TestModel.hook("after", "createOne", afterCreateFn);

      expect(beforeCreateFn).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await TestModel.create({});

      expect(beforeCreateFn).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(1);
    });

    it("should be able to declare after hook inside the before hook", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });

      const afterCreateFn = vi.fn();
      const beforeCreateFn = vi.fn(() => {
        TestModel.hook("after", "createOne", afterCreateFn);
      });

      TestModel.hook("before", "createOne", beforeCreateFn);

      expect(beforeCreateFn).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await TestModel.create({});

      expect(beforeCreateFn).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(1);
    });

    it("should be able to add a hook for a specific adapter only with global adapter register", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();

      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const TestModel = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      });

      Adapter.registerModel(TestModel);

      Model.getClass(TestModel, adapter1).hook("before", "createOne", fn1);
      Model.getClass(TestModel, adapter2).hook("before", "createOne", fn2);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter1).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter2).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it("should be able to add a hook for a specific adapter only with local adapter register", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();

      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const TestModel = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      });

      adapter1.registerModel(TestModel.extend({ adapterClass: adapter1, register: false }));
      adapter2.registerModel(TestModel.extend({ adapterClass: adapter2, register: false }));

      Model.getClass(TestModel, adapter1).hook("before", "createOne", fn1);
      Model.getClass(TestModel, adapter2).hook("before", "createOne", fn2);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter1).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter2).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it("should be able to add a hook for a specific adapter only with auto adapter register (extend)", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();

      const fn1 = vi.fn();
      const fn2 = vi.fn();

      const TestModel = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      });

      TestModel.extend({ adapterClass: adapter1 }).hook("before", "createOne", fn1);
      TestModel.extend({ adapterClass: adapter2 }).hook("before", "createOne", fn2);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter1).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);

      await Model.getClass(TestModel, adapter2).create({});

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Model utils", () => {
    it("should be cloneable", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const i = await TestModel.create({});
      const clone = i.clone();
      expect(clone).toBeInstanceOf(TestModel);
      expect(clone._id).toEqual(i._id);
    });
  });

  describe("Model baseClass", () => {
    it("should keep baseClass with extend", () => {
      let model = BaseModel;

      expect(model.getBaseClass()).toBe(BaseModel);

      Array(5)
        .fill(null)
        .forEach(() => {
          const prevModel = model;
          model = model.extend({ adapterClass: mockAdapter() });
          expect(model).not.toBe(prevModel);
          expect(model.getBaseClass()).toBe(BaseModel);
        });
    });

    it("should always return the base class", () => {
      expect(BaseModel.extend({ adapterClass: mockAdapter() }).getBaseClass()).toBe(BaseModel);

      class CustomAccount extends Account {}

      expect(CustomAccount.getBaseClass()).toBe(CustomAccount);
      expect(CustomAccount.extend({ adapterClass: mockAdapter() }).getBaseClass()).toBe(CustomAccount);
    });
  });

  describe("Model unicity", () => {
    it("should get same model from slug with same adapter", () => {
      const adapter = mockAdapter();
      const model = Model.getClass("accounts", adapter);
      const modelBis = Model.getClass("accounts", adapter);

      expect(model).toBe(modelBis);
    });

    it("should get different models from slug with different adapter", () => {
      const adapter = mockAdapter();
      const model = Model.getClass("accounts");
      const modelBis = Model.getClass("accounts", adapter);

      expect(model).not.toBe(modelBis);
    });
  });

  describe("Model page", () => {
    const adapter = mockAdapter();
    const DocModel = mockModel({
      single: true,
      fields: {
        test: {
          type: FieldTypes.TEXT,
          options: {
            default: "defaultValue",
          },
        },
        nested: {
          type: FieldTypes.OBJECT,
          options: {
            fields: {
              subtitle: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      },
    }).extend({ adapterClass: adapter });

    it("should be able to get data from model", async () => {
      const getPromise = DocModel.get();
      expect(getPromise).toBeInstanceOf(PromiseModel);

      const i = await getPromise;
      expect(i).toBeInstanceOf(DocModel);

      expect(i.test).toEqual("defaultValue");
    });

    it("should not be able to create an instance", async () => {
      const creatingPromise = DocModel.create({});

      await expect(creatingPromise).rejects.toThrow(CoreError);
      await expect(creatingPromise).rejects.toHaveProperty("code", ErrorCodes.INVALID_OPERATION);
    });
  });

  describe("Model execution", () => {
    it("should stop hooks execution when first hook throwing", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(() => {
        throw new Error();
      });
      const beforeCreateFn2 = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1 });
      TestModel.hook("after", "createOne", afterCreateFn);

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);
    });

    it("should stop hooks execution when first hook throwing", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn();
      const beforeCreateFn2 = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1, handleErrors: true });
      TestModel.hook("after", "createOne", afterCreateFn);

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(1);
    });

    it("should still execute hooks with handleErrors = true", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(() => {
        throw new Error();
      });
      const beforeCreateFn2 = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1, handleErrors: true });
      TestModel.hook("after", "createOne", afterCreateFn);

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);
    });

    it("should still execute hooks with handleErrors = true if there is no error", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn();
      const beforeCreateFn2 = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1, handleErrors: true });
      TestModel.hook("after", "createOne", afterCreateFn);

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(1);
    });

    it("should override the error if handleErrors hook is throwing", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(() => {
        throw new Error("a");
      });
      const beforeCreateFn2 = vi.fn(() => {
        throw new Error("b");
      });
      const beforeCreateFn3 = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1, handleErrors: true });
      TestModel.hook("before", "createOne", beforeCreateFn3, { order: 2 });

      await expect(TestModel.create({}))?.rejects.toThrow("b");
    });

    it("should not execute hooks without handleErrors if an error has been emitted", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(() => {
        throw new Error();
      });
      const beforeCreateFn2 = vi.fn();
      const beforeCreateFn3 = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 1, handleErrors: true });
      TestModel.hook("before", "createOne", beforeCreateFn3, { order: 2 });

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn3).toHaveBeenCalledTimes(0);
    });

    it("should execute hooks with handleErrors = true only once", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(() => {
        throw new Error();
      });
      const beforeCreateFn2 = vi.fn();
      const beforeCreateFn3 = vi.fn(() => {
        throw new Error();
      });

      TestModel.hook("before", "createOne", beforeCreateFn1, { order: 0, handleErrors: true });
      TestModel.hook("before", "createOne", beforeCreateFn2, { order: 0 });
      TestModel.hook("before", "createOne", beforeCreateFn3, { order: 1, handleErrors: true });

      await TestModel.create({}).catch(() => null);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(0);
      expect(beforeCreateFn3).toHaveBeenCalledTimes(1);
    });

    it("should execute hooks in order", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const stack: number[] = [];

      TestModel.hook("before", "createOne", () => stack.push(0), { order: 0 });
      TestModel.hook("before", "createOne", () => stack.push(1), { order: 1 });
      TestModel.hook("before", "createOne", () => stack.push(-1), { order: -1 });
      TestModel.hook("before", "createOne", () => stack.push(0)); // default order is 0
      TestModel.hook("after", "createOne", () => stack.push(0), { order: 0 });
      TestModel.hook("after", "createOne", () => stack.push(1), { order: 1 });
      TestModel.hook("after", "createOne", () => stack.push(-1), { order: -1 });
      TestModel.hook("after", "createOne", () => stack.push(0)); // default order is 0

      await TestModel.create({});

      expect(stack).toEqual([-1, 0, 0, 1, -1, 0, 0, 1]);
    });

    it("should execute hooks in order and respect errors handlers", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const stack: number[] = [];

      TestModel.hook("before", "createOne", () => stack.push(0), { order: 0 });
      TestModel.hook("before", "createOne", () => stack.push(1), { order: 1, handleErrors: true });
      TestModel.hook("before", "createOne", () => stack.push(2), { order: 2 });
      TestModel.hook(
        "before",
        "createOne",
        () => {
          stack.push(3);
          throw new Error();
        },
        { order: 3 },
      );
      TestModel.hook("before", "createOne", () => stack.push(4), { order: 4 });
      TestModel.hook(
        "before",
        "createOne",
        () => {
          stack.push(5);
          throw new Error();
        },
        { order: 5, handleErrors: true },
      );
      TestModel.hook("before", "createOne", () => stack.push(6), { order: 6, handleErrors: true });
      TestModel.hook("after", "createOne", () => stack.push(7), { order: 7 });
      TestModel.hook("after", "createOne", () => stack.push(8), { order: 8, handleErrors: true });

      await expect(TestModel.create({})).rejects.toThrow();

      expect(stack).toEqual([0, 1, 2, 3, 5, 6]);
      // 0 is executed (no error)
      // 1 is executed, wheter an error or not
      // 2 is executed (no error)
      // 3 is executed, throwing an error
      // 4 is NOT executed (error before)
      // 5 is executed (handleErrors = true), throwing an error
      // 6 is executed
      // 7 and 8 NOT executed because of errors in before hooks : operation has been aborted
    });

    it("should immediately stop execution when throwing abortToken in before hook", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn();
      const beforeCreateFn2 = vi.fn(({ transaction }) => {
        throw transaction.abortToken;
      });
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1);
      TestModel.hook("before", "createOne", beforeCreateFn2);
      TestModel.hook("after", "createOne", afterCreateFn);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).rejects.toThrow("aborted");

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(1);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);
    });

    it("should immediately stop execution when throwing abortToken in first before hook", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn(({ transaction }) => {
        throw transaction.abortToken;
      });
      const beforeCreateFn2 = vi.fn();
      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1);
      TestModel.hook("before", "createOne", beforeCreateFn2);
      TestModel.hook("after", "createOne", afterCreateFn);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).rejects.toThrow("aborted");

      expect(beforeCreateFn1).toHaveBeenCalledTimes(1);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);
    });

    it("should immediately stop execution when throwing abortToken in first after hook", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      const beforeCreateFn = vi.fn();
      const afterCreateFn1 = vi.fn(({ transaction }) => {
        throw transaction.abortToken;
      });
      const afterCreateFn2 = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn);
      TestModel.hook("after", "createOne", afterCreateFn1);
      TestModel.hook("after", "createOne", afterCreateFn2);

      expect(beforeCreateFn).toHaveBeenCalledTimes(0);
      expect(afterCreateFn1).toHaveBeenCalledTimes(0);
      expect(afterCreateFn2).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).rejects.toThrow("aborted");

      expect(beforeCreateFn).toHaveBeenCalledTimes(1);
      expect(afterCreateFn1).toHaveBeenCalledTimes(1);
      expect(afterCreateFn2).toHaveBeenCalledTimes(0);
    });

    it("should retry execution when throwing retryToken in before hook", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      const beforeCreateFn1 = vi.fn();
      const beforeCreateFn2 = vi.fn(({ transaction }) => {
        if (transaction.retries < 2) throw transaction.retryToken;
      });

      const afterCreateFn = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn1);
      TestModel.hook("before", "createOne", beforeCreateFn2);
      TestModel.hook("after", "createOne", afterCreateFn);

      expect(beforeCreateFn1).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).resolves.toBeDefined();

      expect(beforeCreateFn1).toHaveBeenCalledTimes(3);
      expect(beforeCreateFn2).toHaveBeenCalledTimes(3);
      expect(afterCreateFn).toHaveBeenCalledTimes(1);
    });

    it("should retry execution when throwing retryToken in after hook", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      const beforeCreateFn = vi.fn();
      const afterCreateFn1 = vi.fn(({ transaction }) => {
        if (transaction.retries < 2) throw transaction.retryToken;
      });
      const afterCreateFn2 = vi.fn();

      TestModel.hook("before", "createOne", beforeCreateFn);
      TestModel.hook("after", "createOne", afterCreateFn1);
      TestModel.hook("after", "createOne", afterCreateFn2);

      expect(beforeCreateFn).toHaveBeenCalledTimes(0);
      expect(afterCreateFn1).toHaveBeenCalledTimes(0);
      expect(afterCreateFn2).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).resolves.toBeDefined();

      expect(beforeCreateFn).toHaveBeenCalledTimes(3);
      expect(afterCreateFn1).toHaveBeenCalledTimes(3);
      expect(afterCreateFn2).toHaveBeenCalledTimes(1);
    });

    it("should throw error when throwing retryToken in after hook after 3 retries", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      const beforeCreateFn = vi.fn();
      const afterCreateFn = vi.fn(({ transaction }) => {
        if (transaction.retries < 3) throw transaction.retryToken;
      });

      TestModel.hook("before", "createOne", beforeCreateFn);
      TestModel.hook("after", "createOne", afterCreateFn);

      expect(beforeCreateFn).toHaveBeenCalledTimes(0);
      expect(afterCreateFn).toHaveBeenCalledTimes(0);

      await expect(TestModel.create({})).rejects.toThrow("Too many retries");

      expect(beforeCreateFn).toHaveBeenCalledTimes(3);
      expect(afterCreateFn).toHaveBeenCalledTimes(3);
    });
  });

  describe("Model allowMultipleOperations", () => {
    it("should throw error when trying to updateMultiple on models with allowMultipleOperations = false", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.allowMultipleOperations = false;

      await expect(TestModel.update({}, {})).rejects.toThrow("Cannot run updateMultiple operation");
    });

    it("should be able to updateMultiple on models with allowMultipleOperations = false and query as string (=updateOne)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.allowMultipleOperations = false;

      await expect(TestModel.update("", {})).resolves.toBeDefined();
    });

    it("should throw error when trying to deleteMultiple on models with allowMultipleOperations = false", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.allowMultipleOperations = false;

      await expect(TestModel.delete({})).rejects.toThrow("Cannot run deleteMultiple operation");
    });

    it("should be able to deleteMultiple on models with allowMultipleOperations = false and query as string (=deleteOne)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.allowMultipleOperations = false;

      await expect(TestModel.delete("")).resolves.toBeDefined();
    });

    it("should be able to updateMultiple on models with allowMultipleOperations = true (default)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      await expect(TestModel.update({}, {})).resolves.toBeDefined();
    });

    it("should be able to deleteMultiple on models with allowMultipleOperations = true (default)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      await expect(TestModel.update({}, {})).resolves.toBeDefined();
    });
  });

  describe("Model reload", () => {
    it("should load fields from datamodel", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: generateRandomString(),
        definition: {
          fields: {
            field1: {
              type: FieldTypes.TEXT,
              options: {
                default: "defaultValue",
              },
            },
          },
        },
      });

      const TestModel = Model.getClass(dm);

      expect(TestModel.slug).toEqual(dm.slug);

      await TestModel.reloadModel();

      expect(TestModel.fieldsKeys).toContain("field1");

      const i = TestModel.hydrate({});
      // @ts-ignore
      expect(i.field1).toEqual("defaultValue");

      Object.assign(dm.definition as ModelDefinition, {
        fields: {
          field2: {
            type: FieldTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.fieldsKeys).not.toContain("field1");
      expect(TestModel.fieldsKeys).toContain("field2");
    });

    it("should load fields from single datamodel", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: generateRandomString(),
        definition: {
          single: true,
          fields: {
            field1: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const TestModel = Model.getClass(dm);

      await TestModel.initialize();

      expect(TestModel.isSingle()).toBeTruthy();

      expect(TestModel.slug).toEqual(dm.slug);

      await TestModel.reloadModel();

      expect(TestModel.fieldsKeys).toContain("field1");

      Object.assign(dm.definition as ModelDefinition, {
        fields: {
          field2: {
            type: FieldTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.fieldsKeys).not.toContain("field1");
      expect(TestModel.fieldsKeys).toContain("field2");
    });

    it("should support for keyField change", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: generateRandomString(),
        definition: {
          keyField: "field1",
          fields: {
            field1: {
              type: FieldTypes.TEXT,
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "field1" },
            },
          ],
        },
      });

      const TestModel = Model.getClass(dm);

      await TestModel.reloadModel();

      expect(TestModel.getKeyField()).toEqual("field1");

      expect(TestModel.fieldsKeys).toContain("field1");

      Object.assign(dm.definition || {}, {
        keyField: "field2",
        fields: {
          field2: {
            type: FieldTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.getKeyField()).toEqual("field2");

      expect(TestModel.fieldsKeys).not.toContain("field1");

      expect(TestModel.fieldsKeys).toContain("field2");
    });
  });

  describe("Model adapter", () => {
    it("should return model adapter", async () => {
      const adapter = mockAdapter();
      const TestModel = mockModel().extend({ adapterClass: adapter });

      expect(TestModel.getAdapter()?.base).toBe(adapter);
    });

    it("should be able to use global adapter", async () => {
      const GlobalModel = mockModel();
      const _adapterClass = mockAdapter();
      GlobalModel.adapterClass = _adapterClass;

      class model extends GlobalModel {}

      expect(model.getAdapter()?.base).toBe(_adapterClass);
    });

    it("should return the right adapter", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();
      const adapterGlobal = mockAdapter();

      const model = mockModel();
      model.adapterClass = adapterGlobal;
      const model1 = model.extend({ adapterClass: adapter1 });
      model1.slug = generateRandomString();
      const model2 = model.extend({ adapterClass: adapter2 });
      model2.slug = generateRandomString();
      const model3 = class extends model2 {};
      model3.slug = generateRandomString();
      const model4 = model3.extend({ adapterClass: adapter1 });
      model4.slug = generateRandomString();

      expect(model.getAdapter()?.base).toBe(adapterGlobal);
      expect(model1.getAdapter()?.base).toBe(adapter1);
      expect(model2.getAdapter()?.base).toBe(adapter2);
      expect(model3.getAdapter()?.base).toBe(adapterGlobal);
      expect(model4.getAdapter()?.base).toBe(adapter1);
    });

    it("should detect if model has changed on adapter", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();

      const GlobalModel = mockModel();
      GlobalModel.adapterClass = adapter1;

      const model1 = class extends GlobalModel {};
      expect(model1.getAdapter()?.base).toBe(adapter1);
      expect(model1.hasAdapterClassChanged()).toBeFalsy();
      GlobalModel.adapterClass = adapter2;
      expect(model1.getAdapter()?.base).not.toBe(adapter2);
      expect(model1.hasAdapterClassChanged()).toBeTruthy();
    });
  });

  describe("Model getClass", () => {
    it("should return the same model & initialize once with multiple model get", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();
      await DataModel.extend({ adapterClass: adapter }).create({ slug });

      const model = Model.getClass(slug, adapter);
      const modelBis = Model.getClass(slug, adapter);

      expect(model).toBe(modelBis);

      const spy = vi.spyOn(model, "reloadModel");

      expect(spy).toHaveBeenCalledTimes(0);

      await expect(model.initialize()).resolves.toBeUndefined();
      await expect(modelBis.initialize()).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should throw error at initializing if no adapter", async () => {
      const slug = generateRandomString();

      const model = Model.getClass(slug);

      await expect(model.initialize()).rejects.toThrow(CoreError);
    });

    it("should not throw error at initializing if datamodel exists", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();
      await DataModel.extend({ adapterClass: adapter }).create({ slug });

      const model = Model.getClass(slug).extend({ adapterClass: adapter });

      await expect(model.initialize()).resolves.toBeUndefined();
    });

    it("should not throw error at initializing if datamodel doesn't exists", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();

      const model = Model.getClass(slug).extend({ adapterClass: adapter });

      await expect(model.initialize()).resolves.toBeUndefined();
    });

    it("getClass should return model with the instance adapter", async () => {
      const adapter = mockAdapter();
      const DM = DataModel.extend({ adapterClass: adapter });
      const datamodel = DM.hydrate({ slug: faker.animal.type() });

      const modelFromDM = Model.getClass(datamodel);

      expect(modelFromDM.getAdapter(false)?.base).toBe(adapter);
    });

    it("should return same model from slug and from datamodel instance with same adapter", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();

      const datamodel = DataModel.hydrate({ slug });

      const modelFromDM = Model.getClass(datamodel, adapter);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).toBe(modelFromSlug);
    });

    it("should return different models from slug and from datamodel instance with different adapters", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();

      const datamodel = DataModel.hydrate({ slug });

      const modelFromDM = Model.getClass(datamodel);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).not.toBe(modelFromSlug);
    });

    it("should return different models from slugs with different adapters", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();

      const modelFromDM = Model.getClass(slug);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).not.toBe(modelFromSlug);
    });

    it("should cache class on adapter by slug and use these models in relation fields", async () => {
      const adapter = mockAdapter();

      const slug1 = generateRandomString();
      const slug2 = generateRandomString();

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          definition: {
            fields: {
              rel: {
                type: FieldTypes.RELATION,
                options: {
                  ref: slug1,
                },
              },
            },
          },
        },
      ]);

      const Model1 = class extends Model {
        static slug = slug1;
        static connectable = true;
        static extensible = true;
        static isEnvironmentScoped = true;
      }.extend({ adapterClass: adapter });

      const i1 = await Model.getClass(slug1, adapter).create({});

      i1._id = new ObjectId().toString();

      const i2 = await Model.getClass<
        typeof Model & {
          definition: {
            fields: {
              rel: {
                type: FieldTypes.RELATION;
                options: {
                  ref: "accounts";
                };
              };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i2.rel?.model).toBe(Model1);
    });

    it("should cache class on adapter by slug and use these models in relation fields", async () => {
      const adapter = mockAdapter();

      const slug1 = generateRandomString();
      const slug2 = generateRandomString();

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          definition: {
            fields: {
              rel: {
                type: FieldTypes.RELATION,
                options: {
                  ref: slug1,
                },
              },
            },
          },
        },
      ]);

      const i1 = await Model.getClass(slug1, adapter).create({});

      const i2 = await Model.getClass<
        typeof Model & {
          definition: {
            fields: {
              rel: { type: FieldTypes.RELATION };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i2.rel?.model).toHaveProperty("slug", slug1);

      const Model1 = class extends Model {
        static slug = slug1;
        static connectable = true;
        static extensible = true;
        static isEnvironmentScoped = true;
      }.extend({ adapterClass: adapter, force: true });

      const i3 = await Model.getClass<
        typeof Model & {
          definition: {
            fields: {
              rel: { type: FieldTypes.RELATION };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i3.rel?.model).toBe(Model1);
    });

    it("should cache class on adapter by slug and use these models in array relation fields", async () => {
      const adapter = mockAdapter();

      const slug1 = generateRandomString();
      const slug2 = generateRandomString();

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          definition: {
            fields: {
              rel: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.RELATION,
                    options: {
                      ref: slug1,
                    },
                  },
                },
              },
            },
          },
        },
      ]);

      const Model1 = class extends Model {
        static slug = slug1;
        static connectable = true;
        static extensible = true;
        static isEnvironmentScoped = true;
      }.extend({ adapterClass: adapter });

      const i1 = await Model.getClass(slug1, adapter).create({});

      i1._id = new ObjectId().toString();

      const i2 = await Model.getClass<
        typeof Model & {
          definition: {
            fields: {
              rel: {
                type: FieldTypes.ARRAY;
                options: {
                  items: { type: FieldTypes.RELATION };
                };
              };
            };
          };
        }
      >(slug2, adapter).create({ rel: [i1._id] });

      expect(i2.rel?.model).toBe(Model1);
    });

    it("should be able to get model from class", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static slug = "custom";
        static extensible = false;
        static definition = {
          fields: {
            customField: {
              type: FieldTypes.TEXT,
            },
          },
        };
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter)).toBe(model);
    });

    it("should return the same model from slug and from class", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static slug = "custom";
        static extensible = false;
        static definition = {
          fields: {
            customField: {
              type: FieldTypes.TEXT,
            },
          },
        };
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter)).toBe(model);
    });

    it("should return the same model from slug and from class with same adapter", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static slug = "custom";
        static extensible = false;
        static definition = {
          fields: {
            customField: {
              type: FieldTypes.TEXT,
            },
          },
        };
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter)).toBe(model);
    });

    it("should return different models from slug and from class with different adapters", async () => {
      const adapter = mockAdapter();
      const adapter2 = mockAdapter();

      class CustomModel extends Model {
        static slug = "custom";
        static extensible = false;
        static definition = {
          fields: {
            customField: {
              type: FieldTypes.TEXT,
            },
          },
        };
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter2)).not.toBe(model);
    });

    it("should throw error if model is declared from datamodel first and then from different class", async () => {
      const adapter = mockAdapter();

      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: "custom",
        definition: {
          fields: {
            customField: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const model = Model.getClass(dm, adapter);

      expect(model.prototype).toBeInstanceOf(Model);
      expect(model.extensible).toBeTruthy();
      expect(model.isEnvironmentScoped).toBeTruthy();
      expect(Model.getClass(model, adapter)).toBe(model);

      class CustomModel extends Model {
        static slug = "custom";
        static extensible = false;
      }

      expect(() => Model.getClass(CustomModel, adapter)).toThrow("already registered");
    });
  });

  describe("Model extend", () => {
    it("should return right model constructor", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      const i = await TestModel.create({});

      expect(i.model()).toBe(TestModel);
    });

    it("should return right model constructor when model is cloned", async () => {
      const TestModelCloned = mockModel().extend({ adapterClass: mockAdapter() });

      const i = await TestModelCloned.create({});

      expect(i.model()).toBe(TestModelCloned);
    });

    it("should not throw error if model is extended with different adapter", async () => {
      const adapter1 = mockAdapter();
      const adapter2 = mockAdapter();

      const TestModel = mockModel().extend({ adapterClass: adapter1 });

      expect(TestModel.extend({ adapterClass: adapter2 })).toBeDefined();
    });

    it("should throw error if model is extended with same adapter as the model slug is already registered", async () => {
      const adapter = mockAdapter();

      const TestModel = mockModel().extend({ adapterClass: adapter });

      expect(() => TestModel.extend({ adapterClass: adapter })).toThrow("already registered");
    });

    it("should not throw error if model is extended with same adapter and register: false and not override adapter model", async () => {
      const adapter = mockAdapter();

      const TestModel = mockModel().extend({ adapterClass: adapter });

      expect(TestModel.extend({ adapterClass: adapter, register: false })).toBeDefined();

      const TestModel2 = TestModel.extend({ adapterClass: adapter, register: false });

      expect(adapter.getClosestModel(TestModel.slug)).toBe(TestModel);
      expect(adapter.getClosestModel(TestModel.slug)).not.toBe(TestModel2);
    });

    it("should not throw error if model is extended with same adapter and force: true and override adapter model", async () => {
      const adapter = mockAdapter();

      const TestModel = mockModel().extend({ adapterClass: adapter });

      expect(TestModel.extend({ adapterClass: adapter, force: true })).toBeDefined();

      const TestModel2 = TestModel.extend({ adapterClass: adapter, force: true });

      expect(adapter.getClosestModel(TestModel.slug)).not.toBe(TestModel);
      expect(adapter.getClosestModel(TestModel.slug)).toBe(TestModel2);
    });

    it("should be able to extend medias class fields", async () => {
      const cache = new Set<ModelInstance<typeof Model>>();
      const adapter = mockAdapter({ privateCache: cache });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: "medias",
        definition: {
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                default: "1",
              },
            },
          },
        },
      });

      const model = Model.getClass("medias", adapter);

      await model.initialize();

      expect(model.fieldsMap.has("title")).toBeTruthy();
    });

    it("should be able to extend multiple medias classes", async () => {
      const cache = new Set<ModelInstance<typeof Model>>();

      const adapter1 = mockAdapter({ privateCache: cache });
      const adapter2 = mockAdapter({ privateCache: cache });

      await DataModel.extend({ adapterClass: adapter1 }).create({
        slug: "medias",
        definition: {
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                default: "1",
              },
            },
          },
        },
      });

      const medias1 = Model.getClass("medias", adapter1);
      const medias2 = Model.getClass("medias", adapter2);

      expect(medias1).not.toBe(medias2);

      await medias1.initialize();
      await medias2.initialize();

      expect(medias1.fieldsMap.has("title")).toBeTruthy();
      expect(medias2.fieldsMap.has("title")).toBeTruthy();
    });
  });

  it("should reloadModel only if needed", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const dm = await DataModel.extend({ adapterClass: adapter }).create({
      slug: slug,
      definition: {
        fields: {
          title: {
            type: FieldTypes.TEXT,
            options: {
              default: "1",
            },
          },
        },
      },
    });

    const model1 = Model.getClass(slug, adapter);

    const spyReload = vi.spyOn(model1, "reloadModel");

    expect(spyReload).toHaveBeenCalledTimes(0);

    await model1.initialize();

    expect(spyReload).toHaveBeenCalledTimes(1);

    expect(model1.fieldsMap.has("title")).toBeTruthy();

    const model2 = Model.getClass(slug, adapter);

    const spyReload2 = vi.spyOn(model2, "reloadModel");

    expect(spyReload2).toHaveBeenCalledTimes(0);

    await model2.initialize();

    expect(spyReload2).toHaveBeenCalledTimes(0);

    expect(model2.fieldsMap.has("title")).toBeTruthy();

    await dm.update({
      $set: {
        definition: {
          fields: {
            subtitle: {
              type: FieldTypes.TEXT,
            },
          },
        },
      },
    });

    expect(model2.fieldsMap.has("title")).toBeTruthy();

    await model2.reloadModel();

    expect(model2.fieldsMap.has("subtitle")).toBeTruthy();
    expect(model2.fieldsMap.has("title")).toBeFalsy();
  });

  describe("Model realtime", () => {
    it("should keep realtime flag when getting class from slug", () => {
      const adapter = mockAdapter();
      const TestModel = class extends Model {
        static slug = generateRandomString();
        static realtime = true;
      }.extend({ adapterClass: adapter });

      const ModelFromSlug = Model.getClass(TestModel.slug, adapter);
      expect(ModelFromSlug.realtime).toBe(true);
    });

    it("should keep realtime flag when getting class from model", () => {
      const adapter = mockAdapter();
      const TestModel = class extends Model {
        static slug = generateRandomString();
        static realtime = true;
      }.extend({ adapterClass: adapter });

      const ModelFromClass = Model.getClass(TestModel, adapter);
      expect(ModelFromClass.realtime).toBe(true);
    });

    it("should get realtime flag from datamodel", async () => {
      const adapter = mockAdapter();
      const slug = generateRandomString();

      await DataModel.extend({ adapterClass: adapter }).create({
        slug,
        realtime: true,
        definition: {
          fields: {
            test: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const ModelFromDatamodel = Model.getClass(slug, adapter);
      expect(ModelFromDatamodel.realtime).toBe(false);
      await ModelFromDatamodel.initialize();
      expect(ModelFromDatamodel.realtime).toBe(true);
    });

    it("should not override realtime flag from datamodel if defined in class", async () => {
      const adapter = mockAdapter();
      const TestModel = class extends Model {
        static slug = generateRandomString();
        static realtime = false;
        static extensible = true;
      }.extend({ adapterClass: adapter });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: TestModel.slug,
        realtime: true,
        definition: {
          fields: {
            test: {
              type: FieldTypes.TEXT,
            },
          },
        },
      });

      const ModelFromDatamodel = Model.getClass(TestModel.slug, adapter);
      expect(ModelFromDatamodel.realtime).toBe(false);
    });

    it("should keep realtime for account model", async () => {
      const adapter = mockAdapter();
      const accountModel = Model.getClass("accounts", adapter);
      await accountModel.initialize();
      expect(accountModel.realtime).toBe(true);
    });
  });
});
