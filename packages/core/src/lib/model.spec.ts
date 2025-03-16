import { vi } from "vitest";
import { mockAdapter, mockModel, generateRandomString } from "@/lib/test-utils.dev.js";
import { Property } from "@/lib/property.js";
import { defineConfiguration, Model } from "@/lib/model.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Validator } from "@/lib/validator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Account } from "@/models/account.js";
import { CoreError } from "@/lib/core-error.js";
import { DataModel } from "@/models/data-model.js";
import { ErrorCodes } from "@/enums/error-codes.js";
import { Media } from "@/models/media.js";
import { ModelInstance, SerializerPropertiesMap } from "@/types/index.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { faker } from "@faker-js/faker";
import { Adapter } from "@/lib/adapter.js";
import { ObjectId } from "bson";
import { modelDecorator } from "./model-decorator.js";

describe("Test Model", () => {
  const BaseModel = mockModel({
    slug: faker.random.alphaNumeric(10),
    properties: {
      title: {
        type: PropertyTypes.TEXT,
      },
    },
    validators: [
      {
        type: ValidatorTypes.SAMPLE,
        property: "title",
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

  it("should be able to save a model with a model on a child adapter", async () => {
    class CustomAccount extends Account {
      static __name = "CustomAccount";
      static configuration = defineConfiguration({
        ...Account.configuration,
        slug: "accounts",
      });
      static foo = "bar";
    }

    class AdapterA<T extends typeof Model> extends Adapter<T> {
      static __name = "AdapterA";
    }

    expect(() => Model.getClass(CustomAccount, Adapter)).toThrowError(); // Model "accounts" is already registered with the default account class
    const model = Model.getClass(CustomAccount, AdapterA);
    expect(model.__name).toBe("CustomAccount");
  });

  describe("Model initialization", () => {
    it("should be able to manually define properties", () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });

      expect(model.propertiesKeys).toContain("title");
    });

    it("Model should load properties from adapter", async () => {
      const adapter = mockAdapter();
      const TestModel = BaseModel.extend({ adapterClass: adapter });
      const created = await TestModel.create({});
      expect(created.model().propertiesMap.get("title")).toBeInstanceOf(Property);
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
      const base = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: faker.random.alphaNumeric(10),
            loadDatamodel: true,
          });
        },
      );

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
            keyProperty: "test",
          }).toJSON(),
        },
        adapterClass: mockAdapter(),
      });

      const initFn2 = vi.spyOn(model2, "reloadModel");

      expect(initFn2).toBeCalledTimes(0);

      await model2.initialize();

      expect(initFn2).toBeCalledTimes(1);

      const lastCall2Args = initFn2.mock.calls?.[0]?.[0];

      expect(lastCall2Args?.datamodel).toHaveProperty("properties");

      expect(model.getKeyProperty()).toEqual("_id");
      expect(model2.getKeyProperty()).toEqual("test");
    });

    it("Model.keyProperty is not overriden by datamodel if declared in inherited class", async () => {
      const adapter = mockAdapter();
      const slug1 = faker.random.alphaNumeric(10);
      const slug2 = faker.random.alphaNumeric(10);
      const model = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: slug1,
            connectable: true,
            loadDatamodel: true,
            isEnvironmentScoped: true,
            keyProperty: "test",
          });
        },
      ).extend({ adapterClass: adapter });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: slug2,
        keyProperty: "test2",
        properties: {
          test2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const model2 = modelDecorator()(
        class extends model {
          static configuration = defineConfiguration({
            ...model.configuration,
            slug: slug2,
            connectable: true,
            loadDatamodel: true,
            isEnvironmentScoped: true,
          });
        },
      ).extend({ adapterClass: adapter });

      await model2.initialize();

      expect(model2.getKeyProperty()).toEqual("test");
    });

    it("Medias keyProperty is not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.configuration.slug,
        keyProperty: "test2",
        properties: {
          test2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.propertiesMap.get("test2")).toBeInstanceOf(Property);
      expect(model.getKeyProperty()).toEqual("name");
    });

    it("Medias singularity is not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.configuration.slug,
        single: true,
        properties: {
          test2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.propertiesMap.get("test2")).toBeInstanceOf(Property);
    });

    it("Medias base properties are not overriden by datamodel", async () => {
      const adapter = mockAdapter();
      await DataModel.extend({ adapterClass: adapter }).create({
        slug: Media.configuration.slug,
        single: true,
        properties: {
          name: {
            type: PropertyTypes.NUMBER,
          },
        },
      });

      const model = Media.extend({ adapterClass: adapter });
      await model.initialize();

      expect(model.propertiesMap.get("name")).toBeInstanceOf(Property);
      expect(model.propertiesMap.get("name")?.type).toBe(PropertyTypes.TEXT);
    });
  });

  describe("Model getter", () => {
    it("Model should return property default value if undefined", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.TEXT,
            default: "default",
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({});
      expect(created.get("test")).toBe("default");
    });

    it("should serialize with property from adapter", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({
        test: 123 as unknown as string,
      });

      expect(created.get("test")).toBe("123");
    });

    it("should serialize with nested properties in json", async () => {
      const adapter = mockAdapter();
      const _model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.OBJECT,
            properties: {
              nested: {
                type: PropertyTypes.TEXT,
              },
            },
          },
        },
      });
      const model = _model.extend({ adapterClass: adapter });

      const created = await model.create({
        test: {
          nested: 123 as unknown as string,
        },
      });

      expect(created.get("test.nested")).toBe("123");
      expect(created.test?.nested).toBe("123");
    });

    it("should serialize with nested properties in array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.TEXT,
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

    it("should serialize with nested properties in array of array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.TEXT,
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

    it("should serialize with nested json property in array of array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  nested: {
                    type: PropertyTypes.TEXT,
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

    it("should serialize with nested properties in array of json", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.OBJECT,
              properties: {
                nested: {
                  type: PropertyTypes.TEXT,
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

    it("should serialize with complex schema properties", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          property1: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.OBJECT,
              properties: {
                property2: {
                  type: PropertyTypes.TEXT,
                },
                property3: {
                  type: PropertyTypes.ARRAY,
                  items: {
                    type: PropertyTypes.OBJECT,
                    properties: {
                      property4: {
                        type: PropertyTypes.TEXT,
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
        property1: [
          {
            property2: "test1",
            property3: [
              {
                property4: "test1.1",
              },
              {
                property4: "test1.2",
              },
            ],
          },
          {
            property2: "test2",
            property3: [
              {
                property4: "test2.1",
              },
              {
                property4: "test2.2",
              },
            ],
          },
        ],
      });

      expect(created.get("property1")).toEqual([
        {
          property2: "test1",
          property3: [
            {
              property4: "test1.1",
            },
            {
              property4: "test1.2",
            },
          ],
        },
        {
          property2: "test2",
          property3: [
            {
              property4: "test2.1",
            },
            {
              property4: "test2.2",
            },
          ],
        },
      ]);

      expect(created.get("property1.property2")).toEqual(["test1", "test2"]);
      expect(created.get("property1.[].property2")).toEqual(["test1", "test2"]);
      expect(created.get("property1.property3")).toEqual([
        [
          {
            property4: "test1.1",
          },
          {
            property4: "test1.2",
          },
        ],
        [
          {
            property4: "test2.1",
          },
          {
            property4: "test2.2",
          },
        ],
      ]);

      expect(created.get("property1.property3.property4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("property1.[].property3.property4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("property1.[].property3.[].property4")).toEqual([
        ["test1.1", "test1.2"],
        ["test2.1", "test2.2"],
      ]);

      expect(created.get("property1.[].property3.[].property4.undefined")).toEqual(undefined);
    });

    it("should serialize array of relation to PromiseModelList", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.RELATION,
              ref: "accounts",
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
        slug: faker.random.alphaNumeric(10),
        properties: {
          arr: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.OBJECT,
              properties: {
                arrRel: {
                  type: PropertyTypes.ARRAY,
                  items: {
                    type: PropertyTypes.RELATION,
                    ref: "accounts",
                  },
                },
                rel: {
                  type: PropertyTypes.RELATION,
                  ref: "accounts",
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

    it("should serialize to undefined nested properties of null", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.OBJECT,
            properties: {
              test: {
                type: PropertyTypes.TEXT,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const created = await model.create({});

      expect(created.get("test.test")).toBe(undefined);
    });

    it("should serialize to undefined nested properties of null array", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          test: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.OBJECT,
              properties: {
                test: {
                  type: PropertyTypes.TEXT,
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

    it("should serialize to undefined nested properties of nested unexisting property", async () => {
      const adapter = mockAdapter();
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {},
      }).extend({ adapterClass: adapter });

      const created = await model.create({});

      expect(created.get("obj")).toEqual(undefined);
    });
  });

  describe("Model getter and setter should be consistant", () => {
    const adapter = mockAdapter();
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        text: {
          type: PropertyTypes.TEXT,
        },
        obj: {
          type: PropertyTypes.OBJECT,
          properties: {
            nested: {
              type: PropertyTypes.TEXT,
            },
          },
        },
        relSingle: {
          type: PropertyTypes.RELATION,
          ref: "accounts",
        },
        relArray: {
          type: PropertyTypes.ARRAY,
          items: {
            type: PropertyTypes.RELATION,
            ref: "accounts",
          },
        },
        arrOfText: {
          type: PropertyTypes.ARRAY,
          items: {
            type: PropertyTypes.TEXT,
          },
        },
        complex: {
          type: PropertyTypes.OBJECT,
          properties: {
            nestedArr: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  nested: {
                    type: PropertyTypes.TEXT,
                  },
                },
              },
            },
          },
        },
      },
    }).extend({ adapterClass: adapter });

    const _testWith = async (opts: {
      property: string;
      value: unknown;
      create?: Record<string, unknown>;
      format?: keyof SerializerPropertiesMap;
      primitive?: boolean;
    }) => {
      const { property, value, primitive } = opts;
      let { create, format } = opts;

      format ??= "json";
      create ??= { [property]: value };
      const created = await model.create(create);
      const v = created.get(property);

      const data = { ...(created.getData() as any) };
      data[property] = v;
      created.setData(data);

      const v2 = created.get(property, format);
      if (primitive) {
        expect(String(v2)).toEqual(String(value));
      } else {
        expect(v2).toEqual(value);
      }
    };

    describe("json", () => {
      it("with simple text property", async () => {
        await _testWith({ property: "text", value: "test" });
      });

      it("with array of text property", async () => {
        await _testWith({ property: "arrOfText", value: ["test1", "test2"] });
      });

      it("with json property", async () => {
        await _testWith({ property: "obj", value: { nested: "test" } });
      });

      it("with json property nested", async () => {
        await _testWith({
          property: "obj.nested",
          value: "test",
          create: {
            obj: { nested: "test" },
          },
        });
      });

      it("with relation property", async () => {
        await _testWith({ property: "relSingle", value: "507f191e810c19729de860ea" });
      });

      it("with array of relation property", async () => {
        await _testWith({
          property: "relArray",
          value: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
        });
      });

      it("with complex nested properties", async () => {
        await _testWith({
          property: "complex",
          value: {
            nestedArr: [],
          },
        });

        await _testWith({
          property: "complex.nestedArr",
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
      it("with simple text property", async () => {
        await _testWith({ property: "text", value: "test", format: "object" });
      });

      it("with relation property", async () => {
        await _testWith({
          property: "relSingle",
          value: "507f191e810c19729de860ea",
          format: "object",
          primitive: true,
        });
      });

      it("with array of relation property", async () => {
        await _testWith({
          property: "relArray",
          value: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
          format: "object",
          primitive: true,
        });
      });
    });
  });

  describe("Model validation", () => {
    it("Model should have keyProperty validator if keyProperty is defined", async () => {
      const adapter = mockAdapter();
      const BaseModelWithKeyProperty = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
      });
      Object.assign(BaseModelWithKeyProperty.configuration, { keyProperty: "title" });
      const TestModel = BaseModelWithKeyProperty.extend({ adapterClass: adapter });

      const keyPropertyValidator = TestModel.validatorsArray.find(v => v?.type === ValidatorTypes.KEY_PROPERTY);
      expect(keyPropertyValidator).toBeDefined();
    });

    it("Model should have keyProperty validator if keyProperty is defined and should filter unique and required validators", async () => {
      const adapter = mockAdapter();
      const BaseModelWithKeyProperty = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          { type: ValidatorTypes.UNIQUE, property: "title" },
          { type: ValidatorTypes.REQUIRED, property: "title" },
        ],
      });
      Object.assign(BaseModelWithKeyProperty.configuration, { keyProperty: "title" });
      const TestModel = BaseModelWithKeyProperty.extend({ adapterClass: adapter });

      const validators = TestModel.validatorsArray;

      const keyPropertyValidator = validators.find(v => v?.type === ValidatorTypes.KEY_PROPERTY);
      const uniqueValidator = validators.find(v => v?.type === ValidatorTypes.UNIQUE);
      const requiredValidator = validators.find(v => v?.type === ValidatorTypes.REQUIRED);

      expect(keyPropertyValidator).toBeDefined();
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

    it("Model should validate with property from adapter", async () => {
      const testValidate = vi.fn(() => Promise.resolve(true));

      class TestPropertyText extends Property<PropertyTypes.TEXT> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        propertiesMap: {
          [PropertyTypes.TEXT]: TestPropertyText,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });
      await TestModel.initialize();
      const i = TestModel.hydrate({});
      expect(testValidate).toHaveBeenCalledTimes(0);

      await TestModel.validate([i.getData()]);

      expect(testValidate).toHaveBeenCalledTimes(1);
    });

    it("Model should throw error with property validator returning false", async () => {
      const testValidate = vi.fn(() => Promise.resolve(false));

      class TestPropertyText extends Property<PropertyTypes.TEXT> {
        validate = testValidate;
      }

      const _adapter = mockAdapter({
        propertiesMap: {
          [PropertyTypes.TEXT]: TestPropertyText,
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

    it("Model should validate validators & properties on create", async () => {
      const testValidateProperty = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestPropertyText extends Property<PropertyTypes.TEXT> {
        validate = testValidateProperty;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        propertiesMap: {
          [PropertyTypes.TEXT]: TestPropertyText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateProperty).toHaveBeenCalledTimes(0);
      expect(testValidateValidator).toHaveBeenCalledTimes(0);

      await TestModel.create({});

      expect(testValidateProperty).toHaveBeenCalledTimes(1);
      expect(testValidateValidator).toHaveBeenCalledTimes(1);
    });

    it("Model should validate validators & properties once by value on createMultiple", async () => {
      const testValidateProperty = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestPropertyText extends Property<PropertyTypes.TEXT> {
        validate = testValidateProperty;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        propertiesMap: {
          [PropertyTypes.TEXT]: TestPropertyText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateProperty).toHaveBeenCalledTimes(0);
      expect(testValidateValidator).toHaveBeenCalledTimes(0);

      await TestModel.createMultiple([{}, {}, {}]);

      expect(testValidateProperty).toHaveBeenCalledTimes(1);
      expect(testValidateValidator).toHaveBeenCalledTimes(1);
    });

    it("Model should validate validators & properties once on createMultiple", async () => {
      const testValidateProperty = vi.fn(() => Promise.resolve(true));
      const testValidateValidator = vi.fn(() => Promise.resolve(true));

      class TestPropertyText extends Property<PropertyTypes.TEXT> {
        validate = testValidateProperty;
      }

      class TestValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
        validate = testValidateValidator;
      }

      const _adapter = mockAdapter({
        propertiesMap: {
          [PropertyTypes.TEXT]: TestPropertyText,
        },
        validatorsMap: {
          [ValidatorTypes.SAMPLE]: TestValidatorSample,
        },
      });

      const TestModel = BaseModel.extend({ adapterClass: _adapter });

      expect(testValidateProperty).toHaveBeenCalledTimes(0);
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

      expect(testValidateProperty).toHaveBeenCalledTimes(1);
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
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
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
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
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
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
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
      slug: faker.random.alphaNumeric(10),
      single: true,
      properties: {
        test: {
          type: PropertyTypes.TEXT,
          default: "defaultValue",
        },
        nested: {
          type: PropertyTypes.OBJECT,
          properties: {
            subtitle: {
              type: PropertyTypes.TEXT,
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

      TestModel.configuration.blockMultipleOperations = true;

      await expect(TestModel.update({}, {})).rejects.toThrow("Cannot run updateMultiple operation");
    });

    it("should be able to updateMultiple on models with allowMultipleOperations = false and query as string (=updateOne)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.configuration.blockMultipleOperations = true;

      await expect(TestModel.update("", {})).resolves.toBeDefined();
    });

    it("should throw error when trying to deleteMultiple on models with allowMultipleOperations = false", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.configuration.blockMultipleOperations = true;

      await expect(TestModel.delete({})).rejects.toThrow("Cannot run deleteMultiple operation");
    });

    it("should be able to deleteMultiple on models with allowMultipleOperations = false and query as string (=deleteOne)", async () => {
      const TestModel = mockModel().extend({ adapterClass: mockAdapter() });

      TestModel.configuration.blockMultipleOperations = true;

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
    it("should load properties from datamodel", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: faker.random.alphaNumeric(10),
        properties: {
          property1: {
            type: PropertyTypes.TEXT,
            default: "defaultValue",
          },
        },
      });

      const TestModel = Model.getClass(dm);

      expect(TestModel.configuration.slug).toEqual(dm.slug);

      await TestModel.reloadModel();

      expect(TestModel.propertiesKeys).toContain("property1");

      const i = TestModel.hydrate({});
      // @ts-ignore
      expect(i.property1).toEqual("defaultValue");

      Object.assign(dm.getData(), {
        properties: {
          property2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.propertiesKeys).not.toContain("property1");
      expect(TestModel.propertiesKeys).toContain("property2");
    });

    it("should load properties from single datamodel", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: faker.random.alphaNumeric(10),
        single: true,
        properties: {
          property1: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const TestModel = Model.getClass(dm);

      await TestModel.initialize();

      expect(TestModel.configuration.single).toBeTruthy();

      expect(TestModel.configuration.slug).toEqual(dm.slug);

      await TestModel.reloadModel();

      expect(TestModel.propertiesKeys).toContain("property1");

      Object.assign(dm.getData(), {
        properties: {
          property2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.propertiesKeys).not.toContain("property1");
      expect(TestModel.propertiesKeys).toContain("property2");
    });

    it("should support for keyProperty change", async () => {
      const adapter = mockAdapter();
      const dm = await DataModel.extend({ adapterClass: adapter }).create({
        slug: faker.random.alphaNumeric(10),
        keyProperty: "property1",
        properties: {
          property1: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          {
            type: ValidatorTypes.REQUIRED,
            property: "property1",
          },
        ],
      });

      const TestModel = Model.getClass(dm);

      await TestModel.reloadModel();

      expect(TestModel.getKeyProperty()).toEqual("property1");

      expect(TestModel.propertiesKeys).toContain("property1");

      Object.assign(dm.getData(), {
        keyProperty: "property2",
        properties: {
          property2: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await TestModel.reloadModel();

      expect(TestModel.getKeyProperty()).toEqual("property2");

      expect(TestModel.propertiesKeys).not.toContain("property1");

      expect(TestModel.propertiesKeys).toContain("property2");
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
      model1.configuration.slug = faker.random.alphaNumeric(10);
      const model2 = model.extend({ adapterClass: adapter2 });
      model2.configuration.slug = faker.random.alphaNumeric(10);
      const model3 = class extends model2 {};
      model3.configuration.slug = faker.random.alphaNumeric(10);
      const model4 = model3.extend({ adapterClass: adapter1 });
      model4.configuration.slug = faker.random.alphaNumeric(10);

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
      const slug = faker.random.alphaNumeric(10);
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
      const slug = faker.random.alphaNumeric(10);

      const model = Model.getClass(slug);

      await expect(model.initialize()).rejects.toThrow(CoreError);
    });

    it("should not throw error at initializing if datamodel exists", async () => {
      const adapter = mockAdapter();
      const slug = faker.random.alphaNumeric(10);
      await DataModel.extend({ adapterClass: adapter }).create({ slug });

      const model = Model.getClass(slug).extend({ adapterClass: adapter });

      await expect(model.initialize()).resolves.toBeUndefined();
    });

    it("should not throw error at initializing if datamodel doesn't exists", async () => {
      const adapter = mockAdapter();
      const slug = faker.random.alphaNumeric(10);

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
      const slug = faker.random.alphaNumeric(10);

      const datamodel = DataModel.hydrate({ slug });

      const modelFromDM = Model.getClass(datamodel, adapter);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).toBe(modelFromSlug);
    });

    it("should return different models from slug and from datamodel instance with different adapters", async () => {
      const adapter = mockAdapter();
      const slug = faker.random.alphaNumeric(10);

      const datamodel = DataModel.hydrate({ slug });

      const modelFromDM = Model.getClass(datamodel);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).not.toBe(modelFromSlug);
    });

    it("should return different models from slugs with different adapters", async () => {
      const adapter = mockAdapter();
      const slug = faker.random.alphaNumeric(10);

      const modelFromDM = Model.getClass(slug);
      const modelFromSlug = Model.getClass(slug, adapter);

      expect(modelFromDM).not.toBe(modelFromSlug);
    });

    it("should cache class on adapter by slug and use these models in relation properties", async () => {
      const adapter = mockAdapter();

      const slug1 = faker.random.alphaNumeric(10);
      const slug2 = faker.random.alphaNumeric(10);

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          properties: {
            rel: {
              type: PropertyTypes.RELATION,
              ref: slug1,
            },
          },
        },
      ]);

      const Model1 = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: slug1,
            connectable: true,
            loadDatamodel: true,
            isEnvironmentScoped: true,
          });
        },
      ).extend({ adapterClass: adapter });

      const i1 = await Model.getClass(slug1, adapter).create({});

      i1.getData()._id = new ObjectId().toString();

      const i2 = await Model.getClass<
        typeof Model & {
          configuration: {
            properties: {
              rel: {
                type: PropertyTypes.RELATION;
                ref: "accounts";
              };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i2.rel?.model).toBe(Model1);
    });

    it("should cache class on adapter by slug and use these models in relation properties", async () => {
      const adapter = mockAdapter();

      const slug1 = faker.random.alphaNumeric(10);
      const slug2 = faker.random.alphaNumeric(10);

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          properties: {
            rel: {
              type: PropertyTypes.RELATION,
              ref: slug1,
            },
          },
        },
      ]);

      const i1 = await Model.getClass(slug1, adapter).create({});

      const i2 = await Model.getClass<
        typeof Model & {
          configuration: {
            properties: {
              rel: { type: PropertyTypes.RELATION };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i2.rel?.model).toHaveProperty("configuration.slug", slug1);

      const Model1 = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: slug1,
            connectable: true,
            loadDatamodel: true,
            isEnvironmentScoped: true,
          });
        },
      ).extend({ adapterClass: adapter, force: true });

      const i3 = await Model.getClass<
        typeof Model & {
          configuration: {
            properties: {
              rel: { type: PropertyTypes.RELATION };
            };
          };
        }
      >(slug2, adapter).create({ rel: i1._id });

      expect(i3.rel?.model).toBe(Model1);
    });

    it("should cache class on adapter by slug and use these models in array relation properties", async () => {
      const adapter = mockAdapter();

      const slug1 = faker.random.alphaNumeric(10);
      const slug2 = faker.random.alphaNumeric(10);

      await DataModel.extend({ adapterClass: adapter }).createMultiple([
        {
          slug: slug1,
        },
        {
          slug: slug2,
          properties: {
            rel: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.RELATION,
                ref: slug1,
              },
            },
          },
        },
      ]);

      const Model1 = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: slug1,
            connectable: true,
            loadDatamodel: true,
            isEnvironmentScoped: true,
          });
        },
      ).extend({ adapterClass: adapter });

      const i1 = await Model.getClass(slug1, adapter).create({});

      i1.getData()._id = new ObjectId().toString();

      const i2 = await Model.getClass<
        typeof Model & {
          configuration: {
            properties: {
              rel: {
                type: PropertyTypes.ARRAY;
                items: { type: PropertyTypes.RELATION };
              };
            };
          };
        }
      >(slug2, adapter).create({ rel: [i1._id!] });

      expect(i2.rel?.model).toBe(Model1);
    });

    it("should be able to get model from class", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static configuration = defineConfiguration({
          slug: "custom",
          loadDatamodel: false,
          properties: {
            customProperty: {
              type: PropertyTypes.TEXT,
            },
          },
        });
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter)).toBe(model);
    });

    it("should return the same model from slug and from class", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static configuration = defineConfiguration({
          slug: "custom",
          loadDatamodel: false,
          properties: {
            customProperty: {
              type: PropertyTypes.TEXT,
            },
          },
        });
      }

      const model = Model.getClass(CustomModel, adapter);

      expect(model.prototype).toBeInstanceOf(CustomModel);

      expect(adapter.hasModel("custom")).toBeTruthy();

      expect(Model.getClass("custom", adapter)).toBe(model);
    });

    it("should return the same model from slug and from class with same adapter", async () => {
      const adapter = mockAdapter();

      class CustomModel extends Model {
        static configuration = defineConfiguration({
          slug: "custom",
          loadDatamodel: false,
          properties: {
            customProperty: {
              type: PropertyTypes.TEXT,
            },
          },
        });
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
        static configuration = defineConfiguration({
          slug: "custom",
          loadDatamodel: false,
          properties: {
            customProperty: {
              type: PropertyTypes.TEXT,
            },
          },
        });
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
        properties: {
          customProperty: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const model = Model.getClass(dm, adapter);

      expect(model.prototype).toBeInstanceOf(Model);
      expect(model.configuration.loadDatamodel).toBeTruthy();
      expect(model.configuration.isEnvironmentScoped).toBeTruthy();
      expect(Model.getClass(model, adapter)).toBe(model);

      class CustomModel extends Model {
        static configuration = defineConfiguration({
          slug: "custom",
          loadDatamodel: false,
        });
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

      expect(adapter.getClosestModel(TestModel.configuration.slug)).toBe(TestModel);
      expect(adapter.getClosestModel(TestModel.configuration.slug)).not.toBe(TestModel2);
    });

    it("should not throw error if model is extended with same adapter and force: true and override adapter model", async () => {
      const adapter = mockAdapter();

      const TestModel = mockModel().extend({ adapterClass: adapter });

      expect(TestModel.extend({ adapterClass: adapter, force: true })).toBeDefined();

      const TestModel2 = TestModel.extend({ adapterClass: adapter, force: true });

      expect(adapter.getClosestModel(TestModel.configuration.slug)).not.toBe(TestModel);
      expect(adapter.getClosestModel(TestModel.configuration.slug)).toBe(TestModel2);
    });

    it("should be able to extend medias class properties", async () => {
      const cache = new Set<ModelInstance<typeof Model>>();
      const adapter = mockAdapter({ privateCache: cache });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: "medias",
        properties: {
          title: {
            type: PropertyTypes.TEXT,
            default: "1",
          },
        },
      });

      const model = Model.getClass("medias", adapter);

      await model.initialize();

      expect(model.propertiesMap.has("title")).toBeTruthy();
    });

    it("should be able to extend multiple medias classes", async () => {
      const cache = new Set<ModelInstance<typeof Model>>();

      const adapter1 = mockAdapter({ privateCache: cache });
      const adapter2 = mockAdapter({ privateCache: cache });

      await DataModel.extend({ adapterClass: adapter1 }).create({
        slug: "medias",
        properties: {
          title: {
            type: PropertyTypes.TEXT,
            default: "1",
          },
        },
      });

      const medias1 = Model.getClass("medias", adapter1);
      const medias2 = Model.getClass("medias", adapter2);

      expect(medias1).not.toBe(medias2);

      await medias1.initialize();
      await medias2.initialize();

      expect(medias1.propertiesMap.has("title")).toBeTruthy();
      expect(medias2.propertiesMap.has("title")).toBeTruthy();
    });
  });

  it("should reloadModel only if needed", async () => {
    const slug = faker.random.alphaNumeric(10);
    const adapter = mockAdapter();

    const dm = await DataModel.extend({ adapterClass: adapter }).create({
      slug,
      properties: {
        title: {
          type: PropertyTypes.TEXT,
          default: "1",
        },
      },
    });

    const model1 = Model.getClass(slug, adapter);

    const spyReload = vi.spyOn(model1, "reloadModel");

    expect(spyReload).toHaveBeenCalledTimes(0);

    await model1.initialize();

    expect(spyReload).toHaveBeenCalledTimes(1);

    expect(model1.propertiesMap.has("title")).toBeTruthy();

    const model2 = Model.getClass(slug, adapter);

    const spyReload2 = vi.spyOn(model2, "reloadModel");

    expect(spyReload2).toHaveBeenCalledTimes(0);

    await model2.initialize();

    expect(spyReload2).toHaveBeenCalledTimes(0);

    expect(model2.propertiesMap.has("title")).toBeTruthy();

    await dm.update({
      $set: {
        properties: {
          subtitle: {
            type: PropertyTypes.TEXT,
          },
        },
      },
    });

    expect(model2.propertiesMap.has("title")).toBeTruthy();

    await model2.reloadModel();

    expect(model2.propertiesMap.has("subtitle")).toBeTruthy();
    expect(model2.propertiesMap.has("title")).toBeFalsy();
  });

  describe("Model realtime", () => {
    it("should keep realtime flag when getting class from slug", () => {
      const adapter = mockAdapter();
      const TestModel = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: faker.random.alphaNumeric(10),
            realtime: true,
          });
        },
      ).extend({ adapterClass: adapter });

      const ModelFromSlug = Model.getClass(TestModel.configuration.slug, adapter);
      expect(ModelFromSlug.configuration.realtime).toBe(true);
    });

    it("should keep realtime flag when getting class from model", () => {
      const adapter = mockAdapter();
      const TestModel = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: faker.random.alphaNumeric(10),
            realtime: true,
          });
        },
      ).extend({ adapterClass: adapter });

      const ModelFromClass = Model.getClass(TestModel, adapter);
      expect(ModelFromClass.configuration.realtime).toBe(true);
    });

    it("should get realtime flag from datamodel", async () => {
      const adapter = mockAdapter();
      const slug = faker.random.alphaNumeric(10);

      await DataModel.extend({ adapterClass: adapter }).create({
        slug,
        realtime: true,
        properties: {
          test: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const ModelFromDatamodel = Model.getClass(slug, adapter);
      expect(ModelFromDatamodel.configuration.realtime).toBe(false);
      await ModelFromDatamodel.initialize();
      expect(ModelFromDatamodel.configuration.realtime).toBe(true);
    });

    it("should not override realtime flag from datamodel if defined in class", async () => {
      const adapter = mockAdapter();
      const TestModel = modelDecorator()(
        class extends Model {
          static configuration = defineConfiguration({
            slug: faker.random.alphaNumeric(10),
            realtime: false,
            loadDatamodel: true,
          });
        },
      ).extend({ adapterClass: adapter });

      await DataModel.extend({ adapterClass: adapter }).create({
        slug: TestModel.configuration.slug,
        realtime: true,
        properties: {
          test: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      const ModelFromDatamodel = Model.getClass(TestModel.configuration.slug, adapter);
      expect(ModelFromDatamodel.configuration.realtime).toBe(false);
    });

    it("should keep realtime for account model", async () => {
      const adapter = mockAdapter();
      const accountModel = Model.getClass("accounts", adapter);
      await accountModel.initialize();
    });
  });
});
