import { crossModelTree, getFieldsPathsFromPath, getRelationModelsFromPath } from "@/lib/utils.js";
import { Model } from "@/lib/model.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { mockAdapter, mockModel } from "@/lib/test-utils.dev.js";
import { faker } from "@faker-js/faker";
import { modelDecorator } from "@/lib/model-decorator.js";

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

  describe("getFieldsPathsFromPath", () => {
    it("should return single array entry for one field", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";

      const fPath = getFieldsPathsFromPath(model, "field1");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(1);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");
    });

    it("should decode nested array fields", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.OBJECT,
                      options: {
                        fields: {
                          field2: {
                            type: FieldTypes.TEXT,
                            options: {},
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.items.options.__label = "field1bisbis";

      const fPath1 = getFieldsPathsFromPath(model, "field1.field2");

      expect(fPath1.length).toBe(3);
      expect(fPath1[0]?.key).toBe("field1");
      expect(fPath1[1]?.key).toBe("[]");
      expect(fPath1[2]).toBe(null);

      const fPath2 = getFieldsPathsFromPath(model, "field1.[]?.field2");

      expect(fPath2.length).toBe(4);
      expect(fPath2[0]?.key).toBe("field1");
      expect(fPath2[1]?.key).toBe("[]");
      expect(fPath2[2]?.key).toBe("[]");
      expect(fPath2[3]?.key).toBe("field2");

      const fPath3 = getFieldsPathsFromPath(model, "field1.[].[]?.field2");

      expect(fPath3.length).toBe(4);
      expect(fPath3[0]?.key).toBe("field1");
      expect(fPath3[1]?.key).toBe("[]");
      expect(fPath3[2]?.key).toBe("[]");
      expect(fPath3[3]?.key).toBe("field2");

      const fPath4 = getFieldsPathsFromPath(model, "field1.[]");

      expect(fPath4.length).toBe(2);
      expect(fPath4[0]?.key).toBe("field1");
      expect(fPath4[1]?.key).toBe("[]");
    });

    it("should decode array items field", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                  options: {},
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";

      const fPath = getFieldsPathsFromPath(model, "field1.[]");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath[1]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath[1]?.field).toHaveProperty("options.__label", "field1bis");
    });

    it("should decode array items field with index", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                  options: {},
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";

      const fPath = getFieldsPathsFromPath(model, "field1.[0]");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath[1]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath[1]?.field).toHaveProperty("options.__label", "field1bis");
    });

    it("should decode json fields field", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  field2: {
                    type: FieldTypes.TEXT,
                    options: {},
                  },
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.fields.field2.options.__label = "field2";

      const fPath = getFieldsPathsFromPath(model, "field1.field2");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(2);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath[1]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath[1]?.field).toHaveProperty("options.__label", "field2");
    });

    it("should decode json in array items field", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
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
                        options: {},
                      },
                    },
                  },
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field2.options.__label = "field2";

      const fPath = getFieldsPathsFromPath(model, "field1.field2");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(3);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath[2]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath[2]?.field).toHaveProperty("options.__label", "field2");

      const fPath2 = getFieldsPathsFromPath(model, "field1.[]?.field2");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath2[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath2[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath2[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath2[2]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath2[2]?.field).toHaveProperty("options.__label", "field2");
    });

    it("should return null field for invalid path if strict", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
          fields: {
            field1: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    strict: true,
                    fields: {
                      field2: {
                        type: FieldTypes.TEXT,
                        options: {},
                      },
                    },
                  },
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field2.options.__label = "field2";

      const fPath = getFieldsPathsFromPath(model, "field1.field2.field3");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[3]).toBe(null);

      const fPath2 = getFieldsPathsFromPath(model, "field1.[]?.field3");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[2]).toBe(null);

      const fPath3 = getFieldsPathsFromPath(model, "field2");

      expect(fPath3).toBeInstanceOf(Array);
      expect(fPath3.length).toEqual(1);
      expect(fPath3[0]).toBe(null);

      const fPath4 = getFieldsPathsFromPath(model, "field2.field1");

      expect(fPath4).toBeInstanceOf(Array);
      expect(fPath4.length).toEqual(2);
      expect(fPath4[0]).toBe(null);
      expect(fPath4[1]).toBe(null);
    });

    it("should return nested field for invalid path if not strict (allow to get nested keys for non-strict nested fields)", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
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
                        options: {},
                      },
                    },
                  },
                },
              },
            },
          },
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field2.options.__label = "field2";

      const fPath = getFieldsPathsFromPath(model, "field1.[]?.field3.field4");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[2]).toHaveProperty("key", "field3");
      expect(fPath[2]?.field).toHaveProperty("type", FieldTypes.DEFAULT);
      expect(fPath[2]?.field).toHaveProperty("path", "field1.[].field3");
      expect(fPath[3]).toHaveProperty("key", "field4");
      expect(fPath[3]?.field).toHaveProperty("type", FieldTypes.DEFAULT);
      expect(fPath[3]?.field).toHaveProperty("path", "field1.[].field3.field4");
    });

    it("should decode complex schema fields", () => {
      const model = class extends Model {
        static definition: ModelDefinition = {
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
                        options: {},
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
                                  options: {},
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
        };
      };

      // @ts-expect-error test
      model.definition.fields.field1.options.__label = "field1";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.__label = "field1bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field2.options.__label = "field2";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field3.options.__label = "field3";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field3.options.items.options.__label = "field3bis";
      // @ts-expect-error test
      model.definition.fields.field1.options.items.options.fields.field3.options.items.options.fields.field4.options.__label =
        "field4";

      const fPath = getFieldsPathsFromPath(model, "field1");

      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(1);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath[0]?.field).toHaveProperty("options.__label", "field1");

      const fPath2 = getFieldsPathsFromPath(model, "field1.field2");

      expect(fPath2).toBeInstanceOf(Array);
      expect(fPath2.length).toEqual(3);
      expect(fPath2[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath2[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath2[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath2[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath2[2]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath2[2]?.field).toHaveProperty("options.__label", "field2");

      const fPath3 = getFieldsPathsFromPath(model, "field1.field3");

      expect(fPath3).toBeInstanceOf(Array);
      expect(fPath3.length).toEqual(3);
      expect(fPath3[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath3[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath3[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath3[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath3[2]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath3[2]?.field).toHaveProperty("options.__label", "field3");

      const fPath4 = getFieldsPathsFromPath(model, "field1.field3.field4");

      expect(fPath4).toBeInstanceOf(Array);
      expect(fPath4.length).toEqual(5);
      expect(fPath4[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath4[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath4[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath4[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath4[2]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath4[2]?.field).toHaveProperty("options.__label", "field3");
      expect(fPath4[3]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath4[3]?.field).toHaveProperty("options.__label", "field3bis");
      expect(fPath4[4]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath4[4]?.field).toHaveProperty("options.__label", "field4");

      const fPath5 = getFieldsPathsFromPath(model, "field1.[]?.field2");

      expect(fPath5).toBeInstanceOf(Array);
      expect(fPath5.length).toEqual(3);
      expect(fPath5[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath5[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath5[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath5[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath5[2]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath5[2]?.field).toHaveProperty("options.__label", "field2");

      const fPath6 = getFieldsPathsFromPath(model, "field1.[]?.field3");

      expect(fPath6).toBeInstanceOf(Array);
      expect(fPath6.length).toEqual(3);
      expect(fPath6[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath6[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath6[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath6[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath6[2]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath6[2]?.field).toHaveProperty("options.__label", "field3");

      const fPath7 = getFieldsPathsFromPath(model, "field1.[]?.field3.[]?.field4");

      expect(fPath7).toBeInstanceOf(Array);
      expect(fPath7.length).toEqual(5);
      expect(fPath7[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath7[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath7[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath7[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath7[2]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath7[2]?.field).toHaveProperty("options.__label", "field3");
      expect(fPath7[3]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath7[3]?.field).toHaveProperty("options.__label", "field3bis");
      expect(fPath7[4]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath7[4]?.field).toHaveProperty("options.__label", "field4");

      const fPath8 = getFieldsPathsFromPath(model, "field1.[]?.field3.[]?.field4.field5");

      expect(fPath8).toBeInstanceOf(Array);
      expect(fPath8.length).toEqual(6);
      expect(fPath8[0]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath8[0]?.field).toHaveProperty("options.__label", "field1");
      expect(fPath8[1]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath8[1]?.field).toHaveProperty("options.__label", "field1bis");
      expect(fPath8[2]?.field).toHaveProperty("type", FieldTypes.ARRAY);
      expect(fPath8[2]?.field).toHaveProperty("options.__label", "field3");
      expect(fPath8[3]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath8[3]?.field).toHaveProperty("options.__label", "field3bis");
      expect(fPath8[4]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath8[4]?.field).toHaveProperty("options.__label", "field4");
      expect(fPath8[5]).toBe(null);
    });

    it("should decode nested relation field", async () => {
      const adapter = mockAdapter();
      const model1 = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });

      const model2 = mockModel({
        fields: {
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: model1.slug,
            },
          },
          arrRel: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.RELATION,
                options: {
                  ref: model1.slug,
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const model3 = mockModel({
        fields: {
          nested: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                rel: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: model2.slug,
                  },
                },
                multiRel: {
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
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      const fPath = getFieldsPathsFromPath(model3, "nested.rel.rel.title");
      expect(fPath).toBeInstanceOf(Array);
      expect(fPath.length).toEqual(4);
      expect(fPath[0]?.field).toHaveProperty("type", FieldTypes.OBJECT);
      expect(fPath[0]?.field).toHaveProperty("path", "nested");
      expect(fPath[1]?.field).toHaveProperty("type", FieldTypes.RELATION);
      expect(fPath[1]?.field).toHaveProperty("path", "nested.rel");
      expect(fPath[2]?.field).toHaveProperty("type", FieldTypes.RELATION);
      expect(fPath[2]?.field).toHaveProperty("path", "rel");
      expect(fPath[3]?.field).toHaveProperty("type", FieldTypes.TEXT);
      expect(fPath[3]?.field).toHaveProperty("path", "title");
    });
  });

  describe("getRelationModelsFromPath", () => {
    const adapter = mockAdapter();

    it("should return empty array if no relations found", async () => {
      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "field1");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(0);
    });

    it("should work with single relation field", async () => {
      const model1 = faker.random.alphaNumeric(10);

      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              field1: {
                type: FieldTypes.RELATION,
                options: {
                  ref: model1,
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "field1");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.slug).toBe(model1);
    });

    it("should work with chained relation fields", async () => {
      const model2 = faker.random.alphaNumeric(10);

      const model1 = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              field1: {
                type: FieldTypes.RELATION,
                options: {
                  ref: model2,
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              field1: {
                type: FieldTypes.RELATION,
                options: {
                  ref: model1.slug,
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "field1.field1");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(2);
      expect(models[0]?.slug).toBe(model1.slug);
      expect(models[1]?.slug).toBe(model2);
    });

    it("should work with nested relation fields", async () => {
      const model1 = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              nested: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    rel: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: model1.slug,
                      },
                    },
                  },
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.rel");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.slug).toBe(model1.slug);
    });

    it("should work with nested field in nested array and chained relation fields", async () => {
      const model2 = faker.random.alphaNumeric(10);

      const model1 = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              arr: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        rel: {
                          type: FieldTypes.RELATION,
                          options: {
                            ref: model2,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              nested: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    arr: {
                      type: FieldTypes.ARRAY,
                      options: {
                        items: {
                          type: FieldTypes.OBJECT,
                          options: {
                            fields: {
                              rel: {
                                type: FieldTypes.RELATION,
                                options: {
                                  ref: model1.slug,
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
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.arr.[].rel.arr.[].rel");
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(2);
      expect(models[0]?.slug).toBe(model1.slug);
      expect(models[1]?.slug).toBe(model2);
    });

    it("should return empty array if no relations found in nested field", async () => {
      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              nested: {
                type: FieldTypes.OBJECT,
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "nested.unknown.field");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(0);
    });

    it("should work with nested array in chained relation field", async () => {
      const model1 = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              nested: {
                type: FieldTypes.OBJECT,
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const model = modelDecorator()(
        class extends Model {
          static slug = faker.random.alphaNumeric(10);
          static definition: ModelDefinition = {
            fields: {
              rel: {
                type: FieldTypes.RELATION,
                options: {
                  ref: model1.slug,
                },
              },
            },
          };
        },
      ).extend({ adapterClass: adapter });

      const models = await getRelationModelsFromPath(model, "rel.nested.unknown.field");

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(1);
      expect(models[0]?.slug).toBe(model1.slug);
    });
  });
});
