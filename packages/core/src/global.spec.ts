import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidationError } from "@/lib/validation-error.js";
import { generateRandomString, mockAdapter } from "@/lib/test-utils.dev.js";
import { DataModel } from "@/models/data-model.js";
import { Environment } from "@/models/environment.js";
import { Media } from "@/models/media.js";
import { Model } from "@/lib/model.js";
import { Adapter, Field, FieldObject, ModelDefinition } from "./index.js";

describe("Global tests", () => {
  it("should not be able to create datamodel with invalid fields", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    await expect(
      model.validate([
        {
          slug,
          definition: { fields: "toto" as unknown as ModelDefinition["fields"] },
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          definition: {
            fields: {
              field1: "toto",
            },
          },
        } as object,
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          definition: {
            fields: {
              field1: {
                type: {},
              },
            },
          },
        } as object,
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          definition: {
            fields: {
              field1: {
                type: "invalid",
              },
            },
          },
        } as object,
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should not be able to create datamodel with invalid validators", async () => {
    const slug = generateRandomString();
    const adapter = mockAdapter();

    const model = DataModel.extend({ adapterClass: adapter });

    await expect(model.validate([{ slug, definition: { validators: "toto" } } as object])).rejects.toThrow(
      ValidationError,
    );

    await expect(
      model.validate([
        {
          slug,
          definition: { validators: ["required"] },
        } as object,
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      model.validate([
        {
          slug,
          definition: {
            validators: [
              {
                type: "invalid",
              },
            ],
          },
        } as object,
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
          definition: {
            fields: {
              title: {
                type: FieldTypes.TEXT,
                options: {},
              },
              relSingle: {
                type: FieldTypes.RELATION,
                options: {
                  ref: "ref",
                },
              },
              relMultiple: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.RELATION,
                    options: {
                      ref: "ref",
                    },
                  },
                },
              },
              obj: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    relSingle: {
                      type: FieldTypes.RELATION,
                      options: {
                        ref: "ref",
                      },
                    },
                    relMultiple: {
                      type: FieldTypes.ARRAY,
                      options: {
                        items: {
                          type: FieldTypes.RELATION,
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
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        relSingle: {
                          type: FieldTypes.RELATION,
                          options: {
                            ref: "ref",
                          },
                        },
                        relMultiple: {
                          type: FieldTypes.ARRAY,
                          options: {
                            items: {
                              type: FieldTypes.RELATION,
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
        },
      ]),
    ).resolves.toBeTruthy();
  });

  it("should be able to validate with nested field with defaultField with multiple documents with different fields", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static slug = generateRandomString();
      static definition = {
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              defaultField: {
                type: FieldTypes.OBJECT,
                options: {
                  fields: {
                    title: {
                      type: FieldTypes.TEXT,
                      options: {},
                    },
                  },
                  validators: [
                    {
                      type: ValidatorTypes.REQUIRED,
                      options: {
                        field: "title",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      } satisfies ModelDefinition;
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

  it("should be able to validate with nested field in array with multiple documents with different fields", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static slug = generateRandomString();
      static definition = {
        fields: {
          obj: {
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
                          title: {
                            type: FieldTypes.TEXT,
                            options: {},
                          },
                        },
                        validators: [
                          {
                            type: ValidatorTypes.REQUIRED,
                            options: {
                              field: "title",
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
      } satisfies ModelDefinition;
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

  it("should be able to validate with nested field in array with defaultField with multiple documents with different fields", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static slug = generateRandomString();
      static definition = {
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                arr: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.OBJECT,
                      options: {
                        defaultField: {
                          type: FieldTypes.OBJECT,
                          options: {
                            fields: {
                              nestedArr: {
                                type: FieldTypes.ARRAY,
                                options: {
                                  items: {
                                    type: FieldTypes.OBJECT,
                                    options: {
                                      defaultField: {
                                        type: FieldTypes.OBJECT,
                                        options: {
                                          fields: {
                                            title: {
                                              type: FieldTypes.TEXT,
                                              options: {},
                                            },
                                          },
                                          validators: [
                                            {
                                              type: ValidatorTypes.REQUIRED,
                                              options: {
                                                field: "title",
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
      } satisfies ModelDefinition;
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

  it("should detect unique fields on nested field in array with multiple documents", async () => {
    const adapter = mockAdapter();
    const model = class extends Model {
      static slug = generateRandomString();
      static definition = {
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                arr: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.OBJECT,
                      options: {
                        defaultField: {
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
                                        label: {
                                          type: FieldTypes.TEXT,
                                          options: {},
                                        },
                                      },
                                      validators: [
                                        {
                                          type: ValidatorTypes.UNIQUE,
                                          options: {
                                            field: "label",
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
      } satisfies ModelDefinition;
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

  it("should be able to extend Media model definition", async () => {
    const adapter = mockAdapter();
    await DataModel.extend({ adapterClass: adapter }).create({
      slug: Media.slug,
      definition: {
        fields: {
          title: {
            type: FieldTypes.TEXT,
            options: {},
          },
        },
      },
    });

    const mediaModel = Media.extend({ adapterClass: adapter });
    await mediaModel.initialize();

    expect(mediaModel.fieldsMap.get("title")).toBeTruthy();
  });

  it("should not be able to override Media model validators", async () => {
    const adapter = mockAdapter();
    await DataModel.extend({ adapterClass: adapter }).create({
      slug: Media.slug,
      definition: {
        validators: [],
      },
    });

    const mediaModel = Media.extend({ adapterClass: adapter });
    await mediaModel.initialize();

    expect(mediaModel.validatorsArray.length).toBeGreaterThan(0);
  });

  // TODO: fix this test
  // it("should detect unique fields on nested field in array with multiple documents and different values in nested array", async () => {
  //   const adapter = mockAdapter();
  //   const model = mockModel({
  //     fields: {
  //       obj: {
  //         type: FieldTypes.OBJECT,
  //         options: {
  //           fields: {
  //             arr: {
  //               type: FieldTypes.ARRAY,
  //               options: {
  //                 items: {
  //                   type: FieldTypes.OBJECT,
  //                   options: {
  //                     defaultField: {
  //                       type: FieldTypes.OBJECT,
  //                       options: {
  //                         fields: {
  //                           nestedArr: {
  //                             type: FieldTypes.ARRAY,
  //                             options: {
  //                               items: {
  //                                 type: FieldTypes.OBJECT,
  //                                 options: {
  //                                   fields: {
  //                                     label: {
  //                                       type: FieldTypes.TEXT,
  //                                       options: {},
  //                                     },
  //                                   },
  //                                   validators: [
  //                                     {
  //                                       type: ValidatorTypes.UNIQUE,
  //                                       options: {
  //                                         field: "label",
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
          definition: {
            keyField: "title",
            fields: {
              title: {
                type: FieldTypes.TEXT,
                options: {},
              },
              subtitle: {
                type: FieldTypes.TEXT,
                options: {},
              },
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
          definition: {
            keyField: "title",
            fields: {
              title: {
                type: FieldTypes.TEXT,
                options: {},
              },
            },
            validators: [
              {
                type: ValidatorTypes.REQUIRED,
                options: { field: "title" },
              },
            ],
          },
        },
        {
          slug: generateRandomString(),
          definition: {
            fields: {},
          },
        },
      ]),
    ).resolves.toBeTruthy();

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          definition: {
            keyField: "title",
            fields: {
              title: {
                type: FieldTypes.TEXT,
                options: {},
              },
            },
            validators: [
              {
                type: ValidatorTypes.REQUIRED,
                options: { field: "title" },
              },
            ],
          },
        },
        {
          slug: generateRandomString(),
          definition: {
            fields: {},
            validators: [],
          },
        },
      ]),
    ).resolves.toBeTruthy();
  });

  it("should not be able to create datamodel with non-extensible core model name", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    const registeredModels = Array.from(Adapter._modelsRegistry.values());

    const extensibleModels = registeredModels.filter(model => model.extensible).map(model => model.slug);

    const nonExtensible = registeredModels.filter(model => !model.extensible).map(model => model.slug);

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
      static slug = "sampleCoreModel";
      static extensible = false; // That means it's a core model and creating a datamodel with this slug is not allowed
    }

    await expect(DM.validate([{ slug: "sampleCoreModel" }])).resolves.toBeTruthy(); // CoreModel is not registered in the adapter yet

    adapter.registerModel(CoreModel);

    await expect(DM.validate([{ slug: "sampleCoreModel" }])).rejects.toThrow(ValidationError); // CoreModel is registered in the adapter now so it should not be allowed to create a datamodel with this slug
  });

  it("should not be able to create datamodel with invalid field name", async () => {
    const adapter = mockAdapter();
    const DM = DataModel.extend({ adapterClass: adapter });

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          definition: {
            fields: {
              "invalid name": {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);

    await expect(
      DM.validate([
        {
          slug: generateRandomString(),
          definition: {
            fields: {
              _invalidName: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it("should be able to update model fields", async () => {
    const adapter = mockAdapter();

    const slug = generateRandomString();
    const dm = await DataModel.extend({ adapterClass: adapter }).create({
      slug,
      definition: {
        fields: {
          title: {
            type: FieldTypes.TEXT,
            options: {
              default: "defaultTitle",
            },
          },
        },
      },
    });

    const model = Model.getClass<
      typeof Model & {
        definition: {
          fields: {
            title: {
              type: FieldTypes.TEXT;
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
        definition: {
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                default: "newDefaultTitle",
              },
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

  it("should be able to extend a field type", async () => {
    const adapter = mockAdapter();

    class CustomFieldObject extends FieldObject {
      serializerMap: Field<FieldTypes.OBJECT>["serializerMap"] = {
        json: this._sStatic,
        [Field.defaultSymbol]: this._sProxy,
        // @ts-expect-error test is not defined globally
        test: () => "test",
      };
    }

    adapter.fieldsMap = { ...adapter.fieldsMap, [FieldTypes.OBJECT]: CustomFieldObject };

    const CustomModel = class extends Model {
      static slug = generateRandomString();
      static definition = {
        fields: {
          title: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                a: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        },
      } satisfies ModelDefinition;
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
