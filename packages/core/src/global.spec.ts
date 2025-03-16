import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidationError } from "@/lib/validation-error.js";
import { generateRandomString, mockAdapter } from "@/lib/test-utils.dev.js";
import { DataModel } from "@/models/data-model.js";
import { Environment } from "@/models/environment.js";
import { Media } from "@/models/media.js";
import { defineConfiguration, Model } from "@/lib/model.js";
import { Adapter, Property, PropertyObject } from "./index.js";

describe("Global tests", () => {
  it("should not be able to create datamodel with invalid properties", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          slug,
          // @ts-expect-error test
          properties: "toto",
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          properties: {
            // @ts-expect-error test
            property1: "toto",
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          properties: {
            property1: {
              // @ts-expect-error test
              type: {},
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          properties: {
            property1: {
              // @ts-expect-error test
              type: "invalid",
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should not be able to create datamodel with invalid validators", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    // @ts-expect-error test
    await expect(model.validate([{ slug, validators: "toto" }])).rejects.toThrow(ValidationError);

    // @ts-expect-error test
    await expect(model.validate([{ slug, validators: ["required"] }])).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          validators: [
            {
              // @ts-expect-error test
              type: "invalid",
            },
          ],
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should not be able to create datamodel with more than 100 hooks for an event", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          slug,
          hooks: {
            before_createOne: Array(101).fill(() => ({})),
          },
        } as object,
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          hooks: {
            before_createOne: Array.from({ length: 100 }, () => ({})),
          },
        } as object,
      ]),
    ).resolves.toBeTruthy();

    await expect(
      model.validate([
        {
          slug,
          hooks: {
            before_createOne: Array.from({ length: 99 }, () => ({})),
            after_createOne: Array.from({ length: 99 }, () => ({})),
          },
        } as object,
      ]),
    ).resolves.toBeTruthy();
  });

  it("should be able to validate complex documents", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          slug,
          properties: {
            title: {
              type: PropertyTypes.TEXT,
              options: {},
            },
            relSingle: {
              type: PropertyTypes.RELATION,
              options: {
                ref: "ref",
              },
            },
            relMultiple: {
              type: PropertyTypes.ARRAY,
              options: {
                items: {
                  type: PropertyTypes.RELATION,
                  options: {
                    ref: "ref",
                  },
                },
              },
            },
            obj: {
              type: PropertyTypes.OBJECT,
              options: {
                properties: {
                  relSingle: {
                    type: PropertyTypes.RELATION,
                    options: {
                      ref: "ref",
                    },
                  },
                  relMultiple: {
                    type: PropertyTypes.ARRAY,
                    options: {
                      items: {
                        type: PropertyTypes.RELATION,
                        options: {
                          ref: "ref",
                        },
                      },
                    },
                  },
                },
              },
            },
            objArr: {
              type: PropertyTypes.ARRAY,
              options: {
                items: {
                  type: PropertyTypes.OBJECT,
                  options: {
                    properties: {
                      relSingle: {
                        type: PropertyTypes.RELATION,
                        options: {
                          ref: "ref",
                        },
                      },
                      relMultiple: {
                        type: PropertyTypes.ARRAY,
                        options: {
                          items: {
                            type: PropertyTypes.RELATION,
                            options: {
                              ref: "ref",
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
      ]),
    ).resolves.toBeTruthy();
  });

  it("should be able to validate with nested property with additionalProperties with multiple documents with different properties", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static configuration = defineConfiguration({
        slug: generateRandomString(),
        properties: {
          obj: {
            type: PropertyTypes.OBJECT,
            options: {
              additionalProperties: {
                type: PropertyTypes.OBJECT,
                options: {
                  properties: {
                    title: {
                      type: PropertyTypes.TEXT,
                      options: {},
                    },
                  },
                  validators: [
                    {
                      type: ValidatorTypes.REQUIRED,
                      options: {
                        property: "title",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      });
    }.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          obj: {
            a: { title: "test" },
          },
        },
        {
          obj: {
            b: { title: "test" },
          },
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      model.validate([
        {
          obj: {
            a: { title: "test" },
          },
        },
        {
          obj: {
            b: { noTitle: true },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should be able to validate with nested property in array with multiple documents with different properties", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static configuration = defineConfiguration({
        slug: generateRandomString(),
        properties: {
          obj: {
            type: PropertyTypes.OBJECT,
            options: {
              properties: {
                arr: {
                  type: PropertyTypes.ARRAY,
                  options: {
                    items: {
                      type: PropertyTypes.OBJECT,
                      options: {
                        properties: {
                          title: {
                            type: PropertyTypes.TEXT,
                            options: {},
                          },
                        },
                        validators: [
                          {
                            type: ValidatorTypes.REQUIRED,
                            options: {
                              property: "title",
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          obj: {
            arr: [{ title: "1" }, { title: "2" }],
          },
        },
        {
          obj: {
            arr: [{ title: "3" }, { title: "4" }],
          },
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      model.validate([
        {
          obj: {
            arr: [{ title: "1" }, { noTitle: true }],
          },
        },
        {
          obj: {
            arr: [{ title: "3" }, { title: "4" }],
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should be able to validate with nested property in array with additionalProperties with multiple documents with different properties", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static configuration = defineConfiguration({
        slug: generateRandomString(),
        properties: {
          obj: {
            type: PropertyTypes.OBJECT,
            options: {
              properties: {
                arr: {
                  type: PropertyTypes.ARRAY,
                  options: {
                    items: {
                      type: PropertyTypes.OBJECT,
                      options: {
                        additionalProperties: {
                          type: PropertyTypes.OBJECT,
                          options: {
                            properties: {
                              nestedArr: {
                                type: PropertyTypes.ARRAY,
                                options: {
                                  items: {
                                    type: PropertyTypes.OBJECT,
                                    options: {
                                      additionalProperties: {
                                        type: PropertyTypes.OBJECT,
                                        options: {
                                          properties: {
                                            title: {
                                              type: PropertyTypes.TEXT,
                                              options: {},
                                            },
                                          },
                                          validators: [
                                            {
                                              type: ValidatorTypes.REQUIRED,
                                              options: {
                                                property: "title",
                                              },
                                            },
                                          ],
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
            },
          },
        },
      });
    }.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ a0: { title: "1" } }, { a1: { title: "2" } }],
                },
                b: {
                  nestedArr: [{ b0: { title: "3" } }, { b1: { title: "4" } }],
                },
              },
              {
                b: {
                  nestedArr: [{ b0: { title: "1" } }, { b1: { title: "2" } }],
                },
                c: {
                  nestedArr: [{ c0: { title: "3" } }, { c1: { title: "4" } }],
                },
              },
              {
                c: {
                  nestedArr: [{ c0: { title: "1" } }, { c1: { title: "2" } }],
                },
                d: {
                  nestedArr: [{ d0: { title: "3" } }, { d1: { title: "4" } }],
                },
              },
            ],
          },
        },
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ a0: { title: "1" } }, { a1: { title: "2" } }],
                },
                b: {
                  nestedArr: [{ b0: { title: "3" } }, { b1: { title: "4" } }],
                },
              },
              {
                b: {
                  nestedArr: [{ b0: { title: "1" } }, { b1: { title: "2" } }],
                },
                c: {
                  nestedArr: [{ c0: { title: "3" } }, { c1: { title: "4" } }],
                },
              },
              {
                c: {
                  nestedArr: [{ c0: { title: "1" } }, { c1: { title: "2" } }],
                },
                d: {
                  nestedArr: [{ d0: { title: "3" } }, { d1: { title: "4" } }],
                },
              },
            ],
          },
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      model.validate([
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ a0: { title: "1" } }, { a1: { title: "2" } }],
                },
                b: {
                  nestedArr: [{ b0: { title: "3" } }, { b1: { noTitle: true } }],
                },
              },
              {
                b: {
                  nestedArr: [{ b0: { title: "1" } }, { b1: { title: "2" } }],
                },
                c: {
                  nestedArr: [{ c0: { title: "3" } }, { c1: { title: "4" } }],
                },
              },
              {
                c: {
                  nestedArr: [{ c0: { title: "1" } }, { c1: { title: "2" } }],
                },
                d: {
                  nestedArr: [{ d0: { title: "3" } }, { d1: { title: "4" } }],
                },
              },
            ],
          },
        },
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ a0: { title: "1" } }, { a1: { title: "2" } }],
                },
                b: {
                  nestedArr: [{ b0: { title: "3" } }, { b1: { title: "4" } }],
                },
              },
              {
                b: {
                  nestedArr: [{ b0: { title: "1" } }, { b1: { title: "2" } }],
                },
                c: {
                  nestedArr: [{ c0: { title: "3" } }, { c1: { title: "4" } }],
                },
              },
              {
                c: {
                  nestedArr: [{ c0: { title: "1" } }, { c1: { title: "2" } }],
                },
                d: {
                  nestedArr: [{ d0: { title: "3" } }, { d1: { title: "4" } }],
                },
              },
            ],
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should detect unique properties on nested property in array with multiple documents", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static configuration = defineConfiguration({
        slug: generateRandomString(),
        properties: {
          obj: {
            type: PropertyTypes.OBJECT,
            options: {
              properties: {
                arr: {
                  type: PropertyTypes.ARRAY,
                  options: {
                    items: {
                      type: PropertyTypes.OBJECT,
                      options: {
                        additionalProperties: {
                          type: PropertyTypes.OBJECT,
                          options: {
                            properties: {
                              nestedArr: {
                                type: PropertyTypes.ARRAY,
                                options: {
                                  items: {
                                    type: PropertyTypes.OBJECT,
                                    options: {
                                      properties: {
                                        label: {
                                          type: PropertyTypes.TEXT,
                                          options: {},
                                        },
                                      },
                                      validators: [
                                        {
                                          type: ValidatorTypes.UNIQUE,
                                          options: {
                                            property: "label",
                                          },
                                        },
                                      ],
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
        },
      });
    }.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ label: "1" }, { label: "2" }],
                },
                b: {
                  nestedArr: [{ label: "3" }, { label: "4" }],
                },
              },
            ],
          },
        },
        {
          obj: {
            arr: [
              {
                a: {
                  nestedArr: [{ label: "5" }, { label: "6" }],
                },
                b: {
                  nestedArr: [{ label: "3" }, { label: "4" }],
                },
              },
            ],
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should be able to extend Media model configuration", async () => {
    const adapter = mockAdapter();
    await DataModel.extend({ adapterClass: adapter }).create({
      slug: Media.configuration.slug,
      properties: {
        title: {
          type: PropertyTypes.TEXT,
          options: {},
        },
      },
    });

    const mediaModel = Media.extend({ adapterClass: adapter });
    await mediaModel.initialize();

    expect(mediaModel.propertiesMap.get("title")).toBeTruthy();
  });

  it("should not be able to override Media model validators", async () => {
    const adapter = mockAdapter();
    await DataModel.extend({ adapterClass: adapter }).create({
      slug: Media.configuration.slug,
      validators: [],
    });

    const mediaModel = Media.extend({ adapterClass: adapter });
    await mediaModel.initialize();

    expect(mediaModel.validatorsArray.length).toBeGreaterThan(0);
  });

  // TODO: fix this test
  // it("should detect unique properties on nested property in array with multiple documents and different values in nested array", async () => {
  //   const adapter = mockAdapter();
  //   const model = mockModel({
  //     properties: {
  //       obj: {
  //         type: PropertyTypes.OBJECT,
  //         options: {
  //           properties: {
  //             arr: {
  //               type: PropertyTypes.ARRAY,
  //               options: {
  //                 items: {
  //                   type: PropertyTypes.OBJECT,
  //                   options: {
  //                     additionalProperties: {
  //                       type: PropertyTypes.OBJECT,
  //                       options: {
  //                         properties: {
  //                           nestedArr: {
  //                             type: PropertyTypes.ARRAY,
  //                             options: {
  //                               items: {
  //                                 type: PropertyTypes.OBJECT,
  //                                 options: {
  //                                   properties: {
  //                                     label: {
  //                                       type: PropertyTypes.TEXT,
  //                                       options: {},
  //                                     },
  //                                   },
  //                                   validators: [
  //                                     {
  //                                       type: ValidatorTypes.UNIQUE,
  //                                       options: {
  //                                         property: "label",
  //                                       },
  //                                     },
  //                                   ],
  //                                 },
  //                               },
  //                             },
  //                           },
  //                         },
  //                       },
  //                     },
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   }).extend({ adapterClass: adapter});

  //   await expect(
  //     model.validate([
  //       ({
  //         obj: {
  //           arr: [
  //             {
  //               a: {
  //                 nestedArr: [{ label: "1" }, { label: "2" }],
  //               },
  //               b: {
  //                 nestedArr: [{ label: "3" }, { label: "4" }],
  //               },
  //             },
  //           ],
  //         },
  //       }),
  //       ({
  //         obj: {
  //           arr: [
  //             {
  //               a: {
  //                 nestedArr: [{ label: "5" }, { label: "6" }],
  //               },
  //               b: {
  //                 nestedArr: [{ label: "7" }, { label: "4" }],
  //               },
  //             },
  //           ],
  //         },
  //       }),
  //     ])
  //   ).rejects.toThrow(ValidationError);
  // });

  it("should be able to create multiple datamodels at once", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          keyProperty: "title",
          properties: {
            title: {
              type: PropertyTypes.TEXT,
              options: {},
            },
            subtitle: {
              type: PropertyTypes.TEXT,
              options: {},
            },
          },
        },
        {
          slug: generateRandomString(),
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          keyProperty: "title",
          properties: {
            title: {
              type: PropertyTypes.TEXT,
              options: {},
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { property: "title" },
            },
          ],
        },
        {
          slug: generateRandomString(),
          properties: {},
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          keyProperty: "title",
          properties: {
            title: {
              type: PropertyTypes.TEXT,
              options: {},
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { property: "title" },
            },
          ],
        },
        {
          slug: generateRandomString(),
          properties: {},
          validators: [],
        },
      ]),
    ).resolves.toBeTruthy();
  });

  it("should not be able to create datamodel with non-extensible core model name", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    const registeredModels = Array.from(Adapter._modelsRegistry.values());

    const extensibleModels = registeredModels
      .filter(model => model.configuration.loadDatamodel)
      .map(model => model.configuration.slug);

    const nonExtensible = registeredModels
      .filter(model => !model.configuration.loadDatamodel)
      .map(model => model.configuration.slug);

    for (const slug of extensibleModels) {
      await expect(DM.validate([{ slug }])).resolves.toBeTruthy();
    }

    for (const slug of nonExtensible) {
      await expect(DM.validate([{ slug }])).rejects.toThrow(ValidationError);
    }
  });

  it("should load core models from adapter", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    class CoreModel extends Model {
      static configuration = defineConfiguration({
        slug: "sampleCoreModel",
        loadDatamodel: false, // That means it's a core model and creating a datamodel with this slug is not allowed
      });
    }

    await expect(DM.validate([{ slug: "sampleCoreModel" }])).resolves.toBeTruthy(); // CoreModel is not registered in the adapter yet

    adapter.registerModel(CoreModel);

    await expect(DM.validate([{ slug: "sampleCoreModel" }])).rejects.toThrow(ValidationError); // CoreModel is registered in the adapter now so it should not be allowed to create a datamodel with this slug
  });

  it("should not be able to create datamodel with invalid property name", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          properties: {
            "invalid name": {
              type: PropertyTypes.TEXT,
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          properties: {
            _invalidName: {
              type: PropertyTypes.TEXT,
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should be able to update model properties", async () => {
    const adapter = mockAdapter();

    const slug = generateRandomString();
    const dm = await DataModel.extend({ adapterClass: adapter }).create({
      slug,
      properties: {
        title: {
          type: PropertyTypes.TEXT,
          options: {
            default: "defaultTitle",
          },
        },
      },
    });

    const model = Model.getClass<
      typeof Model & {
        configuration: {
          properties: {
            title: {
              type: PropertyTypes.TEXT;
              options: {
                default: string;
              };
            };
          };
        };
      }
    >(dm);
    const i = await model.create({
      title: undefined,
    });

    expect(i.title).toBe("defaultTitle");

    await dm.update({
      $set: {
        slug,
        properties: {
          title: {
            type: PropertyTypes.TEXT,
            options: {
              default: "newDefaultTitle",
            },
          },
        },
      },
    });

    await model.reloadModel();

    expect(i.title).toBe("newDefaultTitle");
  });

  it("should not be able to create an environment with master or main as name", async () => {
    const adapter = mockAdapter();
    const _Environment = Environment.extend({ adapterClass: adapter });

    await expect(_Environment.create({ name: "master" })).rejects.toThrow(ValidationError);

    await expect(_Environment.create({ name: "main" })).rejects.toThrow(ValidationError);

    await expect(_Environment.create({ name: "test" })).resolves.toBeTruthy();
  });

  it("should be able to create a datamodel with one letter as slug", async () => {
    const adapter = mockAdapter();
    const _DataModel = DataModel.extend({ adapterClass: adapter });

    await expect(_DataModel.create({ slug: "a" })).resolves.toBeTruthy();
  });

  it("should be able to extend a property type", async () => {
    const adapter = mockAdapter();

    class CustomPropertyObject extends PropertyObject {
      serializerMap: Property<PropertyTypes.OBJECT>["serializerMap"] = {
        json: this._sStatic,
        [Property.defaultSymbol]: this._sProxy,
        // @ts-expect-error test is not defined globally
        test: () => "test",
      };
    }

    adapter.propertiesMap = { ...adapter.propertiesMap, [PropertyTypes.OBJECT]: CustomPropertyObject };

    const CustomModel = class extends Model {
      static configuration = defineConfiguration({
        slug: generateRandomString(),
        properties: {
          title: {
            type: PropertyTypes.OBJECT,
            options: {
              properties: {
                a: {
                  type: PropertyTypes.TEXT,
                },
              },
            },
          },
        },
      });
    }.extend({ adapterClass: adapter });

    const i = CustomModel.hydrate({
      title: {
        a: "test",
      },
    });

    expect(i.get("title")).toEqual({ a: "test" });
    // @ts-expect-error test is not defined globally
    expect(i.get("title", "test")).toBe("test");
  });
});
