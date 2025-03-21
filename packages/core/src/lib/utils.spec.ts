import { crossModelTree, defineModelConf, getPropertiesPathsFromPath, getRelationModelsFromPath } from "@/lib/utils.js";
import { Model } from "@/lib/model.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { mockAdapter, mockModel } from "@/lib/test-utils.dev.js";
import { faker } from "@faker-js/faker";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { assignDatamodel } from "@/lib/utils.js";
import { ModelJSON } from "@/types/properties.js";
import { DataModel } from "@/models/data-model.js";

describe("test utils", () => {
  describe("crossModelTree", () => {
    it("should cross model parents until Model class", () => {
      const adapter = mockAdapter();
      const model1 = Model.extend({ adapterClass: adapter, force: true });
      const model1bis = class extends model1 {};
      const model1bisbis = class extends model1bis {};
      const model2 = class extends model1bisbis {};

      const called: Array<typeof Model> = [];

      crossModelTree(model2, model => called.push(model));

      expect(called).toContain(model2);
      expect(called).toContain(model1bisbis);
      expect(called).toContain(model1bis);
      expect(called).toContain(model1);
      expect(called).toContain(Model);
      expect(called).toHaveLength(5);
    });
  });

  describe("getPropertiesPathsFromPath", () => {
    it("should return single array entry for one property", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";

      const fPath = getPropertiesPathsFromPath(model, "property1");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(1);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");
    });

    it("should decode nested array properties", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.ARRAY,
                items: {
                  type: PropertyTypes.OBJECT,
                  properties: {
                    property2: {
                      type: PropertyTypes.STRING,
                    },
                  },
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.items.__label = "property1bisbis";

      const fPath1 = getPropertiesPathsFromPath(model, "property1.property2");

      expect(fPath1.length).toBe(3);
      expect(fPath1[0]?.key).toBe("property1");
      expect(fPath1[1]?.key).toBe("[]");
      expect(fPath1[2]).toBe(null);

      const fPath2 = getPropertiesPathsFromPath(model, "property1.[]?.property2");

      expect(fPath2.length).toBe(4);
      expect(fPath2[0]?.key).toBe("property1");
      expect(fPath2[1]?.key).toBe("[]");
      expect(fPath2[2]?.key).toBe("[]");
      expect(fPath2[3]?.key).toBe("property2");

      const fPath3 = getPropertiesPathsFromPath(model, "property1.[].[]?.property2");

      expect(fPath3.length).toBe(4);
      expect(fPath3[0]?.key).toBe("property1");
      expect(fPath3[1]?.key).toBe("[]");
      expect(fPath3[2]?.key).toBe("[]");
      expect(fPath3[3]?.key).toBe("property2");

      const fPath4 = getPropertiesPathsFromPath(model, "property1.[]");

      expect(fPath4.length).toBe(2);
      expect(fPath4[0]?.key).toBe("property1");
      expect(fPath4[1]?.key).toBe("[]");
    });

    it("should decode array items property", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";

      const fPath = getPropertiesPathsFromPath(model, "property1.[]");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath[1]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath[1]?.property).toHaveProperty("definition.__label", "property1bis");
    });

    it("should decode array items property with index", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";

      const fPath = getPropertiesPathsFromPath(model, "property1.[0]");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath[1]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath[1]?.property).toHaveProperty("definition.__label", "property1bis");
    });

    it("should decode json properties property", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.OBJECT,
              properties: {
                property2: {
                  type: PropertyTypes.STRING,
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.properties.property2.__label = "property2";

      const fPath = getPropertiesPathsFromPath(model, "property1.property2");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath[1]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath[1]?.property).toHaveProperty("definition.__label", "property2");
    });

    it("should decode json in array items property", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  property2: {
                    type: PropertyTypes.STRING,
                  },
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property2.__label = "property2";

      const fPath = getPropertiesPathsFromPath(model, "property1.property2");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(3);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath[2]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath[2]?.property).toHaveProperty("definition.__label", "property2");

      const fPath2 = getPropertiesPathsFromPath(model, "property1.[]?.property2");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath2[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath2[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath2[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath2[2]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath2[2]?.property).toHaveProperty("definition.__label", "property2");
    });

    it("should return null property for invalid path if strict", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                strict: true,
                properties: {
                  property2: {
                    type: PropertyTypes.STRING,
                  },
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property2.__label = "property2";

      const fPath = getPropertiesPathsFromPath(model, "property1.property2.property3");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[3]).toBe(null);

      const fPath2 = getPropertiesPathsFromPath(model, "property1.[]?.property3");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[2]).toBe(null);

      const fPath3 = getPropertiesPathsFromPath(model, "property2");

      expect(fPath3).toBeInstanceOf(Array);
      expect(fPath3.length).toEqual(1);
      expect(fPath3[0]).toBe(null);

      const fPath4 = getPropertiesPathsFromPath(model, "property2.property1");

      expect(fPath4).toBeInstanceOf(Array);
      expect(fPath4.length).toEqual(2);
      expect(fPath4[0]).toBe(null);
      expect(fPath4[1]).toBe(null);
    });

    it("should return nested property for invalid path if not strict (allow to get nested keys for non-strict nested properties)", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  property2: {
                    type: PropertyTypes.STRING,
                  },
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property2.__label = "property2";

      const fPath = getPropertiesPathsFromPath(model, "property1.[]?.property3.property4");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[2]).toHaveProperty("key", "property3");
      expect(fPath[2]?.property).toHaveProperty("type", PropertyTypes.DEFAULT);
      expect(fPath[2]?.property).toHaveProperty("path", "property1.[].property3");
      expect(fPath[3]).toHaveProperty("key", "property4");
      expect(fPath[3]?.property).toHaveProperty("type", PropertyTypes.DEFAULT);
      expect(fPath[3]?.property).toHaveProperty("path", "property1.[].property3.property4");
    });

    it("should decode complex schema properties", () => {
      const model = class extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            property1: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  property2: {
                    type: PropertyTypes.STRING,
                  },
                  property3: {
                    type: PropertyTypes.ARRAY,
                    items: {
                      type: PropertyTypes.OBJECT,
                      properties: {
                        property4: {
                          type: PropertyTypes.STRING,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      };

      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.__label = "property1";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.__label = "property1bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property2.__label = "property2";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property3.__label = "property3";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property3.items.__label = "property3bis";
      // @ts-expect-error Add label for testing
      model.configuration.properties.property1.items.properties.property3.items.properties.property4.__label =
        "property4";

      const fPath = getPropertiesPathsFromPath(model, "property1");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(1);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath[0]?.property).toHaveProperty("definition.__label", "property1");

      const fPath2 = getPropertiesPathsFromPath(model, "property1.property2");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath2[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath2[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath2[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath2[2]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath2[2]?.property).toHaveProperty("definition.__label", "property2");

      const fPath3 = getPropertiesPathsFromPath(model, "property1.property3");

      expect(fPath3).toBeInstanceOf(Array);
      expect(fPath3.length).toEqual(3);
      expect(fPath3[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath3[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath3[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath3[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath3[2]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath3[2]?.property).toHaveProperty("definition.__label", "property3");

      const fPath4 = getPropertiesPathsFromPath(model, "property1.property3.property4");

      expect(fPath4).toBeInstanceOf(Array);
      expect(fPath4.length).toEqual(5);
      expect(fPath4[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath4[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath4[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath4[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath4[2]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath4[2]?.property).toHaveProperty("definition.__label", "property3");
      expect(fPath4[3]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath4[3]?.property).toHaveProperty("definition.__label", "property3bis");
      expect(fPath4[4]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath4[4]?.property).toHaveProperty("definition.__label", "property4");

      const fPath5 = getPropertiesPathsFromPath(model, "property1.[]?.property2");

      expect(fPath5).toBeInstanceOf(Array);
      expect(fPath5.length).toEqual(3);
      expect(fPath5[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath5[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath5[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath5[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath5[2]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath5[2]?.property).toHaveProperty("definition.__label", "property2");

      const fPath6 = getPropertiesPathsFromPath(model, "property1.[]?.property3");

      expect(fPath6).toBeInstanceOf(Array);
      expect(fPath6.length).toEqual(3);
      expect(fPath6[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath6[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath6[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath6[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath6[2]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath6[2]?.property).toHaveProperty("definition.__label", "property3");

      const fPath7 = getPropertiesPathsFromPath(model, "property1.[]?.property3.[]?.property4");

      expect(fPath7).toBeInstanceOf(Array);
      expect(fPath7.length).toEqual(5);
      expect(fPath7[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath7[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath7[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath7[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath7[2]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath7[2]?.property).toHaveProperty("definition.__label", "property3");
      expect(fPath7[3]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath7[3]?.property).toHaveProperty("definition.__label", "property3bis");
      expect(fPath7[4]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath7[4]?.property).toHaveProperty("definition.__label", "property4");

      const fPath8 = getPropertiesPathsFromPath(model, "property1.[]?.property3.[]?.property4.property5");

      expect(fPath8).toBeInstanceOf(Array);
      expect(fPath8.length).toEqual(6);
      expect(fPath8[0]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath8[0]?.property).toHaveProperty("definition.__label", "property1");
      expect(fPath8[1]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath8[1]?.property).toHaveProperty("definition.__label", "property1bis");
      expect(fPath8[2]?.property).toHaveProperty("type", PropertyTypes.ARRAY);
      expect(fPath8[2]?.property).toHaveProperty("definition.__label", "property3");
      expect(fPath8[3]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath8[3]?.property).toHaveProperty("definition.__label", "property3bis");
      expect(fPath8[4]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath8[4]?.property).toHaveProperty("definition.__label", "property4");
      expect(fPath8[5]).toBe(null);
    });

    it("should decode nested relation property", async () => {
      const adapter = mockAdapter();
      const model1 = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.STRING,
          },
        },
      }).extend({ adapterClass: adapter });

      const model2 = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          rel: {
            type: PropertyTypes.RELATION,
            ref: model1.configuration.slug,
          },
          arrRel: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.RELATION,
              ref: model1.configuration.slug,
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const model3 = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          nested: {
            type: PropertyTypes.OBJECT,
            properties: {
              rel: {
                type: PropertyTypes.RELATION,
                ref: model2.configuration.slug,
              },
              multiRel: {
                type: PropertyTypes.ARRAY,
                items: {
                  type: PropertyTypes.RELATION,
                  ref: model2.configuration.slug,
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const fPath = getPropertiesPathsFromPath(model3, "nested.rel.rel.title");
      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[0]?.property).toHaveProperty("type", PropertyTypes.OBJECT);
      expect(fPath[0]?.property).toHaveProperty("path", "nested");
      expect(fPath[1]?.property).toHaveProperty("type", PropertyTypes.RELATION);
      expect(fPath[1]?.property).toHaveProperty("path", "nested.rel");
      expect(fPath[2]?.property).toHaveProperty("type", PropertyTypes.RELATION);
      expect(fPath[2]?.property).toHaveProperty("path", "rel");
      expect(fPath[3]?.property).toHaveProperty("type", PropertyTypes.STRING);
      expect(fPath[3]?.property).toHaveProperty("path", "title");
    });
  });

  describe("getRelationModelsFromPath", () => {
    const adapter = mockAdapter();

    it("should work with single relation property", async () => {
      const model1 = faker.random.alphaNumeric(10);

      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              property1: {
                type: PropertyTypes.RELATION,
                ref: model1,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "property1");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.configuration.slug).toBe(model1);
    });

    it("should work with chained relation properties", async () => {
      const model2 = faker.random.alphaNumeric(10);

      const model1 = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              property1: {
                type: PropertyTypes.RELATION,
                ref: model2,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              property1: {
                type: PropertyTypes.RELATION,
                ref: model1.configuration.slug,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "property1.property1");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(2);
      expect(models[0]?.configuration.slug).toBe(model1.configuration.slug);
      expect(models[1]?.configuration.slug).toBe(model2);
    });

    it("should work with nested relation properties", async () => {
      const model1 = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
          });
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              nested: {
                type: PropertyTypes.OBJECT,
                properties: {
                  rel: {
                    type: PropertyTypes.RELATION,
                    ref: model1.configuration.slug,
                  },
                },
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.rel");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.configuration.slug).toBe(model1.configuration.slug);
    });

    it("should work with nested property in nested array and chained relation properties", async () => {
      const model2 = faker.random.alphaNumeric(10);

      const model1 = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              arr: {
                type: PropertyTypes.ARRAY,
                items: {
                  type: PropertyTypes.OBJECT,
                  properties: {
                    rel: {
                      type: PropertyTypes.RELATION,
                      ref: model2,
                    },
                  },
                },
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              nested: {
                type: PropertyTypes.OBJECT,
                properties: {
                  arr: {
                    type: PropertyTypes.ARRAY,
                    items: {
                      type: PropertyTypes.OBJECT,
                      properties: {
                        rel: {
                          type: PropertyTypes.RELATION,
                          ref: model1.configuration.slug,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.arr.[].rel.arr.[].rel");
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(2);
      expect(models[0]?.configuration.slug).toBe(model1.configuration.slug);
      expect(models[1]?.configuration.slug).toBe(model2);
    });

    it("should return empty array if no relations found in nested property", async () => {
      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              nested: {
                type: PropertyTypes.OBJECT,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.unknown.property");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(0);
    });

    it("should work with nested array in chained relation property", async () => {
      const model1 = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              nested: {
                type: PropertyTypes.OBJECT,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static configuration = defineModelConf({
            slug: faker.random.alphaNumeric(10),
            properties: {
              rel: {
                type: PropertyTypes.RELATION,
                ref: model1.configuration.slug,
              },
            },
          });
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "rel.nested.unknown.property");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.configuration.slug).toBe(model1.configuration.slug);
    });
  });

  describe("assignDatamodel", () => {
    it("should assign properties and validators from datamodel", async () => {
      const adapter = mockAdapter();
      const baseModel = mockModel({
        slug: "baseModel",
        properties: {
          baseProperty: {
            type: PropertyTypes.STRING,
          },
        },
        validators: [
          {
            type: ValidatorTypes.REQUIRED,
            property: "baseProperty",
          },
        ],
        required: ["baseProperty"],
      }).extend({ adapterClass: adapter });

      const datamodel: ModelJSON<typeof DataModel> = {
        slug: "dataModel",
        properties: {
          dataProperty: {
            type: PropertyTypes.NUMBER,
          },
        },
        validators: [
          {
            type: ValidatorTypes.UNIQUE,
            property: "dataProperty",
          },
        ],
        required: ["dataProperty"],
        _id: "some-id",
        _createdAt: new Date().toISOString(),
        _createdBy: "creator-id",
        _updatedAt: new Date().toISOString(),
        _updatedBy: "updater-id",
      };

      await assignDatamodel(baseModel, datamodel);

      expect(baseModel.configuration.properties).toHaveProperty("baseProperty");
      expect(baseModel.configuration.properties).toHaveProperty("dataProperty");
      expect(baseModel.configuration.validators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: ValidatorTypes.REQUIRED, property: "baseProperty" }),
          expect.objectContaining({ type: ValidatorTypes.UNIQUE, property: "dataProperty" }),
        ]),
      );
      expect(baseModel.configuration.required).toEqual(expect.arrayContaining(["baseProperty", "dataProperty"]));
    });

    it("should handle empty datamodel properties and validators", async () => {
      const adapter = mockAdapter();
      const baseModel = mockModel({
        slug: "baseModel",
        properties: {
          baseProperty: {
            type: PropertyTypes.STRING,
          },
        },
        validators: [
          {
            type: ValidatorTypes.REQUIRED,
            property: "baseProperty",
          },
        ],
        required: ["baseProperty"],
      }).extend({ adapterClass: adapter });

      const datamodel: ModelJSON<typeof DataModel> = {
        slug: "dataModel",
        properties: {},
        validators: [],
        required: [],
        _id: "some-id",
        _createdAt: new Date().toISOString(),
        _createdBy: "creator-id",
        _updatedAt: new Date().toISOString(),
        _updatedBy: "updater-id",
      };

      await assignDatamodel(baseModel, datamodel);

      expect(baseModel.configuration.properties).toHaveProperty("baseProperty");
      expect(baseModel.configuration.validators).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: ValidatorTypes.REQUIRED, property: "baseProperty" })]),
      );
      expect(baseModel.configuration.required).toEqual(expect.arrayContaining(["baseProperty"]));
    });
  });
});
