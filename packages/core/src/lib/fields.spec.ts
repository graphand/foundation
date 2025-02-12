import { vi } from "vitest";
import { ObjectId } from "bson";
import { generateRandomString, mockAdapter, mockModel } from "@/lib/test-utils.dev.js";
import { FieldTypes } from "@/enums/field-types.js";
import { faker } from "@faker-js/faker";
import { Field } from "@/lib/field.js";
import { Validator } from "@/lib/validator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ValidationError } from "@/lib/validation-error.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { Account, DataModel, JSONType, Model, Patterns } from "@/index.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";

describe("test fields", () => {
  const adapter = mockAdapter({});

  describe("Text field", () => {
    it("should return default value if undefined", async () => {
      const defaultText = faker.lorem.word();

      const model = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
            options: {
              default: defaultText,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({});
      expect(i.title).toEqual(defaultText);
    });

    it("should return string value by default", async () => {
      const model = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const title = faker.lorem.word();

      const i = model.hydrate({ title });
      expect(i.title).toEqual(title);
    });

    it("should return string from array by default", async () => {
      const model = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const titleArray = [faker.lorem.word(), faker.lorem.word()];

      const i = model.hydrate({ title: titleArray } as object);
      expect(typeof i.title).toBe("string");
    });

    it("should not be able to save an _id in a TEXT field", async () => {
      const model = mockModel({
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ title: String(new ObjectId()) });

      await expect(model.validate([i.getData()])).rejects.toThrow(ValidationError);
    });
  });

  describe("Nested field", () => {
    it("should return default value if undefined", async () => {
      const defaultJSON = { default: true };

      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              default: defaultJSON,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({});
      expect(i.obj).toEqual(defaultJSON);
    });

    it("should return object value by default", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const obj = { title: faker.lorem.word() };

      const i = model.hydrate({ obj });
      expect(i.obj).toBeInstanceOf(Object);
    });

    it("should return object from array by default", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const obj = [{ title: faker.lorem.word() }, { title: faker.lorem.word() }];

      const i = model.hydrate({ obj } as object);
      expect(i.obj).toBeInstanceOf(Object);
      expect(Array.isArray(i.obj)).toBeFalsy();
    });

    it("should return undefined if no value", async () => {
      const model = DataModel.extend({ adapterClass: adapter });

      const i = await model.create({
        slug: generateRandomString(),
        definition: {
          fields: {
            test: {
              type: FieldTypes.OBJECT,
            },
          },
        },
      });
      expect(i.get("definition.fields.test.options", "json")).toBe(undefined);
    });

    it("should not bind default values with defaults=false", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              default: { test: 1 },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({});

      expect(i.get("obj")).toEqual({ test: 1 });
      expect(i.get("obj", undefined, { defaults: false })).toEqual(undefined);
    });

    it("should not bind default values with defaults=false in nested fields", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                foo: {
                  type: FieldTypes.TEXT,
                  options: {
                    default: "bar",
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        obj: {},
      });

      expect(i.get("obj.foo")).toEqual("bar");
      expect(i.get("obj.foo", undefined, { defaults: false })).toEqual(undefined);
    });

    it("should merge default values in json by default", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                field1: {
                  type: FieldTypes.TEXT,
                  options: {
                    default: "foo",
                  },
                },
                field2: {
                  type: FieldTypes.TEXT,
                  options: {
                    default: "bar",
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        obj: {
          field1: "test",
        },
      });

      expect(i.get("obj")).toEqual({ field1: "test" });
      expect(i.get("obj", "json")).toEqual({
        field1: "test",
        field2: "bar",
      });
    });

    it("should not merge default values in json with defaults=false", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              fields: {
                field1: {
                  type: FieldTypes.TEXT,
                  options: {
                    default: "foo",
                  },
                },
                field2: {
                  type: FieldTypes.TEXT,
                  options: {
                    default: "bar",
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        obj: {
          field1: "test",
        },
      });

      expect(i.get("obj")).toEqual({ field1: "test" });
      expect(i.get("obj", "json", { defaults: false })).toEqual({
        field1: "test",
      });
    });

    describe("Validation", () => {
      it("should throw error if value is not an object", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const obj: object = { obj: true };
        await expect(() => model.validate([obj])).rejects.toThrow(ValidationError);
      });

      it("should validate well with defaultField", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
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
        await model.initialize();

        await expect(
          model.validate([{ obj: { field1: ["test1", "test2"], field2: ["test3", "test4", "test5"] } }]),
        ).resolves.toBeTruthy();
      });
    });

    describe("Proxy", () => {
      it("should return an object proxy", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const i = model.hydrate({
          obj: {},
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj?.__isProxy).toBe(true);
      });

      it("should not call other fields serializers thanks to the proxy", async () => {
        const serializeText = vi.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = vi.fn(({ value }) => {
          return parseFloat(value);
        });

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: serializeText,
              };
            },
            [FieldTypes.NUMBER]: class extends Field<FieldTypes.NUMBER> {
              serializerMap = {
                [Field.defaultSymbol]: serializeNumber,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                  value: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        expect(serializeText).not.toHaveBeenCalled();
        expect(serializeNumber).not.toHaveBeenCalled();

        const i = model.hydrate({
          obj: {
            title: "test",
            value: 123,
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj?.title).toBe("test");

        expect(serializeText).toHaveBeenCalledTimes(1);
        expect(serializeNumber).not.toHaveBeenCalled();
      });

      it("should not call other fields serializers thanks to the proxy even in nested objects", async () => {
        const serializeText = vi.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = vi.fn(({ value }) => {
          return parseFloat(value);
        });

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: serializeText,
              };
            },
            [FieldTypes.NUMBER]: class extends Field<FieldTypes.NUMBER> {
              serializerMap = {
                [Field.defaultSymbol]: serializeNumber,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  subObj: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        title: {
                          type: FieldTypes.TEXT,
                        },
                        value: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                    },
                  },
                  subValue: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        expect(serializeText).not.toHaveBeenCalled();
        expect(serializeNumber).not.toHaveBeenCalled();

        const i = model.hydrate({
          obj: {
            subObj: {
              title: "test",
              value: 123,
            },
            subValue: 456,
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj?.subObj).toBeInstanceOf(Object);
        expect(i.obj?.subObj?.title).toBe("test");
        expect(serializeText).toHaveBeenCalledTimes(1);

        expect(i.get("obj.subObj.title")).toBe("test");

        expect(serializeNumber).not.toHaveBeenCalled();
      });

      it("should not call other fields serializers thanks to the proxy even in nested array", async () => {
        const serializeText = vi.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = vi.fn(({ value }) => {
          return parseFloat(value);
        });

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: serializeText,
              };
            },
            [FieldTypes.NUMBER]: class extends Field<FieldTypes.NUMBER> {
              serializerMap = {
                [Field.defaultSymbol]: serializeNumber,
              };
            },
          },
        });

        const model = mockModel({
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
                      },
                      value: {
                        type: FieldTypes.NUMBER,
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        expect(serializeText).not.toHaveBeenCalled();
        expect(serializeNumber).not.toHaveBeenCalled();

        const i = model.hydrate({
          arr: [
            {
              title: "test",
              value: 123,
            },
          ],
        });

        expect(i.arr).toBeInstanceOf(Array);
        expect(i.arr?.[0]).toBeInstanceOf(Object);
        expect(i.arr?.[0]?.title).toBe("test");

        expect(serializeText).toHaveBeenCalledTimes(1);
        expect(serializeNumber).not.toHaveBeenCalled();
      });
    });

    describe("options.strict", () => {
      it("should return only defined fields in options when strict", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const obj = {
          title: faker.lorem.word(),
          fieldNotDefined: faker.lorem.word(),
        };

        const i = model.hydrate({ obj });

        const _obj = i.obj as any;

        expect(_obj).toBeInstanceOf(Object);
        expect(_obj.title).toEqual(obj.title);
        expect(_obj.fieldNotDefined).toBe(undefined);
      });
    });

    describe("options.fields", () => {
      it("should serialize from fields defined in options", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = vi.fn(() => serializedText);

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: testSerializer,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {
          title: faker.lorem.word(),
        };

        const i = model.hydrate({ obj });
        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj?.title).toEqual(serializedText);
      });

      it("should validate fields defined in options", async () => {
        const testValidator = vi.fn(() => Promise.resolve(true));

        class TestFieldText extends Field<FieldTypes.TEXT> {
          validate = testValidator;
        }

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: TestFieldText,
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = { title: faker.lorem.word() };

        const i = model.hydrate({ obj });

        expect(testValidator).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidator).toBeCalledTimes(1);
      });

      it("should support nested JSON fields", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = vi.fn(() => serializedText);
        const testValidator = vi.fn(() => Promise.resolve(true));

        class TestFieldText extends Field<FieldTypes.TEXT> {
          validate = testValidator;

          serializerMap = {
            [Field.defaultSymbol]: testSerializer,
          };
        }

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: TestFieldText,
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        title: {
                          type: FieldTypes.TEXT,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {
          nested: {
            title: faker.lorem.word(),
          },
        };

        const i = model.hydrate({ obj });
        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj?.nested).toBeInstanceOf(Object);
        expect(i.obj?.nested?.title).toEqual(serializedText);

        expect(testValidator).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidator).toBeCalledTimes(1);
      });

      it("should throw error if error happens in field validation", async () => {
        const testValidator = vi.fn(() => Promise.resolve(false));

        class TestFieldText extends Field<FieldTypes.TEXT> {
          validate = testValidator;
        }

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: TestFieldText,
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        title: {
                          type: FieldTypes.TEXT,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {
          nested: {
            title: faker.lorem.word(),
          },
        };

        const i = model.hydrate({ obj });

        try {
          await model.validate([i.getData()]);
        } catch (e) {
          expect(e).toBeInstanceOf(ValidationError);
          expect((e as ValidationError).fieldsPaths.includes("obj.nested.title")).toBeTruthy();
        }
      });
    });

    describe("options.validators", () => {
      it("should validate validators defined in options", async () => {
        const testValidate = vi.fn(() => Promise.resolve(true));

        const _adapter = mockAdapter({
          validatorsMap: {
            [ValidatorTypes.REQUIRED]: class extends Validator<ValidatorTypes.REQUIRED> {
              validate = testValidate;
            },
          },
        });

        const model = mockModel({
          validators: [],
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "title" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {};

        const i = model.hydrate({ obj });

        expect(testValidate).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidate).toBeCalledTimes(1);
      });

      it("should throw error if error happens in validator", async () => {
        const testValidate = vi.fn(() => Promise.resolve(false));

        const _adapter = mockAdapter({
          validatorsMap: {
            [ValidatorTypes.REQUIRED]: class extends Validator<ValidatorTypes.REQUIRED> {
              validate = testValidate;
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "title" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {};
        const i = model.hydrate({ obj });

        expect.assertions(1);

        try {
          await model.validate([i.getData()]);
        } catch (e) {
          expect(e).toBeDefined();
        }
      });

      it("should support nested JSON fields and should not validate if nested value undefined", async () => {
        const testValidate = vi.fn(() => Promise.resolve(true));

        const _adapter = mockAdapter({
          validatorsMap: {
            [ValidatorTypes.REQUIRED]: class extends Validator<ValidatorTypes.REQUIRED> {
              validate = testValidate;
            },
          },
        });

        const model = mockModel({
          validators: [],
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.OBJECT,
                    options: {
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "title" },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = {};

        const i = model.hydrate({ obj });

        expect(testValidate).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidate).toBeCalledTimes(0);
      });

      it("should support nested JSON fields and should validate if nested value is not undefined", async () => {
        const testValidate = vi.fn(() => Promise.resolve(true));

        const _adapter = mockAdapter({
          validatorsMap: {
            [ValidatorTypes.REQUIRED]: class extends Validator<ValidatorTypes.REQUIRED> {
              validate = testValidate;
            },
          },
        });

        const model = mockModel({
          validators: [],
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.OBJECT,
                    options: {
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "title" },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const obj = { nested: {} };

        const i = model.hydrate({ obj });

        expect(testValidate).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidate).toBeCalledTimes(1);
      });
    });

    // The `conditionalFields` option allows certain fields to be included or excluded based on the value of another field.
    // It uses `dependsOn` to specify the reference field and defines `mappings` to determine which sub-fields to activate.
    // An optional `defaultMapping` can be provided for cases where the `dependsOn` value doesn't match any mapping.
    // Validators and serializers are applied only to the active fields as defined by the current mapping.
    describe("options.conditionalFields", () => {
      it("should use conditionalFields to determine which fields to include based on a field value", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack"],
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  defaultMapping: "email",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const email = faker.internet.email();

        const i = model.hydrate({
          channel: "email",
          options: {
            email,
            slackWebhookUrl: "https://hooks.slack.com/services/...",
          },
        });

        expect(i.options).toBeInstanceOf(Object);
        expect(i.options?.email).toBe(email);
        expect(i.options?.slackWebhookUrl).toBeUndefined();
      });

      it("should apply validators conditionally based on conditionalFields", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack"],
                blbal: true,
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  defaultMapping: "email",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "email" },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "slackWebhookUrl" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        // Should pass validation when email is provided
        await expect(
          model.validate([
            {
              channel: "email",
              options: {
                email: faker.internet.email(),
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail validation when email is missing
        await expect(
          model.validate([
            {
              channel: "email",
              options: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);

        // Should pass validation when slackWebhookUrl is provided
        await expect(
          model.validate([
            {
              channel: "slack",
              options: {
                slackWebhookUrl: "https://hooks.slack.com/services/...",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail validation when slackWebhookUrl is missing
        await expect(
          model.validate([
            {
              channel: "slack",
              options: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should apply nested validators conditionally based on conditionalFields", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["type1", "type2"],
              },
            },
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  field1: {
                    type: FieldTypes.OBJECT,
                    options: {
                      strict: true,
                      fields: {
                        field11: { type: FieldTypes.TEXT },
                        field12: { type: FieldTypes.TEXT },
                      },
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "field12" },
                        },
                      ],
                    },
                  },
                  field2: {
                    type: FieldTypes.OBJECT,
                    options: {
                      strict: true,
                      fields: {
                        field21: { type: FieldTypes.TEXT },
                        field22: { type: FieldTypes.TEXT },
                      },
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "field22" },
                        },
                      ],
                    },
                  },
                },
                conditionalFields: {
                  dependsOn: "$.type",
                  mappings: {
                    type1: ["field1"],
                    type2: ["field2"],
                  },
                },
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.field1.field11" },
            },
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.field2.field21" },
            },
          ],
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        await expect(
          model.validate([
            {
              type: "type1",
              obj: {
                field1: {
                  field11: "value",
                  field12: "value",
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              type: "type2",
              obj: {
                field2: {
                  field21: "value",
                  field22: "value",
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(model.validate([{}])).rejects.toThrow(ValidationError);

        await expect(
          model.validate([
            {
              type: "type1",
              obj: {
                field1: {
                  field11: "value",
                },
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);

        await expect(
          model.validate([
            {
              type: "type1",
              obj: {
                field2: {
                  field21: "value",
                  field22: "value",
                },
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should work with nested conditionalFields", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  mode: {
                    type: FieldTypes.ENUM,
                    options: {
                      enum: ["simple", "advanced"],
                    },
                  },
                  config: {
                    type: FieldTypes.OBJECT,
                    options: {
                      strict: true,
                      fields: {
                        simpleOption: { type: FieldTypes.TEXT },
                        advancedOption: { type: FieldTypes.NUMBER },
                      },
                      conditionalFields: {
                        dependsOn: "$.mode",
                        defaultMapping: "simple",
                        mappings: {
                          simple: ["simpleOption"],
                          advanced: ["advancedOption"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const i = model.hydrate({
          settings: {
            mode: "simple",
            config: {
              simpleOption: "option1",
              advancedOption: 123,
            },
          },
        });

        expect(i.settings?.config?.simpleOption).toBe("option1");
        expect(i.settings?.config?.advancedOption).toBeUndefined();
      });

      it("should work with conditionalFields in arrays", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            items: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: ["A", "B"],
                        },
                      },
                      data: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            fieldA: { type: FieldTypes.TEXT },
                            fieldB: { type: FieldTypes.NUMBER },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            defaultMapping: "A",
                            mappings: {
                              A: ["fieldA"],
                              B: ["fieldB"],
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
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const i = model.hydrate({
          items: [
            {
              type: "A",
              data: {
                fieldA: "valueA",
                fieldB: 100,
              },
            },
            {
              type: "B",
              data: {
                fieldA: "valueB",
                fieldB: 200,
              },
            },
          ],
        });

        expect(i.items?.[0]?.data?.fieldA).toBe("valueA");
        expect(i.items?.[0]?.data?.fieldB).toBeUndefined();
        expect(i.items?.[1]?.data?.fieldA).toBeUndefined();
        expect(i.items?.[1]?.data?.fieldB).toBe(200);
      });

      it("should validate only the fields specified in the conditionalFields mapping", async () => {
        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack"],
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  defaultMapping: "email",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "email" },
                  },
                  {
                    type: ValidatorTypes.REGEX,
                    options: { field: "email", pattern: Patterns.EMAIL },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "slackWebhookUrl" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should pass when email is valid
        await expect(
          model.validate([
            {
              channel: "email",
              options: {
                email: "user@example.com",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail when email is invalid
        await expect(
          model.validate([
            {
              channel: "email",
              options: {
                email: "invalid-email",
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);

        // Should fail when email is missing
        await expect(
          model.validate([
            {
              channel: "email",
              options: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);

        // Should pass when slackWebhookUrl is provided
        await expect(
          model.validate([
            {
              channel: "slack",
              options: {
                slackWebhookUrl: "https://hooks.slack.com/services/...",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail when slackWebhookUrl is missing
        await expect(
          model.validate([
            {
              channel: "slack",
              options: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should ignore validators for fields not included in the conditionalFields mapping", async () => {
        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack"],
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  defaultMapping: "email",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "email" },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "slackWebhookUrl" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should not require slackWebhookUrl when channel is email
        await expect(
          model.validate([
            {
              channel: "email",
              options: {
                email: "user@example.com",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should not require email when channel is slack
        await expect(
          model.validate([
            {
              channel: "slack",
              options: {
                slackWebhookUrl: "https://hooks.slack.com/services/...",
              },
            },
          ]),
        ).resolves.toBeTruthy();
      });

      it("should default to defaultMapping when value not in mappings", async () => {
        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack", "unknown"],
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  defaultMapping: "email",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "email" },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "slackWebhookUrl" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should use default mapping when channel is unknown
        const i = model.hydrate({
          channel: "unknown",
          options: {
            email: "user@example.com",
            slackWebhookUrl: "https://hooks.slack.com/services/...",
          },
        });

        expect(i.options?.email).toBe("user@example.com");
        expect(i.options?.slackWebhookUrl).toBeUndefined();
      });

      it("should handle conditionalFields without defaultMapping", async () => {
        const model = mockModel({
          fields: {
            channel: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["email", "slack", "unknown"],
              },
            },
            options: {
              type: FieldTypes.OBJECT,
              options: {
                strict: true,
                fields: {
                  email: { type: FieldTypes.TEXT },
                  slackWebhookUrl: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "channel",
                  mappings: {
                    email: ["email"],
                    slack: ["slackWebhookUrl"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "email" },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "slackWebhookUrl" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should include no fields when channel is unknown
        const i = model.hydrate({
          channel: "unknown",
          options: {
            email: "user@example.com",
            slackWebhookUrl: "https://hooks.slack.com/services/...",
          },
        });

        expect(i.options?.email).toBeUndefined();
        expect(i.options?.slackWebhookUrl).toBeUndefined();
      });

      it("should support using '$' to reference parent fields", async () => {
        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  mode: {
                    type: FieldTypes.ENUM,
                    options: {
                      enum: ["light", "dark"],
                    },
                  },
                  theme: {
                    type: FieldTypes.OBJECT,
                    options: {
                      strict: true,
                      fields: {
                        lightOption: { type: FieldTypes.TEXT },
                        darkOption: { type: FieldTypes.TEXT },
                      },
                      conditionalFields: {
                        dependsOn: "$.mode",
                        mappings: {
                          light: ["lightOption"],
                          dark: ["darkOption"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          settings: {
            mode: "light",
            theme: {
              lightOption: "bright",
              darkOption: "dim",
            },
          },
        });

        expect(i.settings?.theme?.lightOption).toBe("bright");
        expect(i.settings?.theme?.darkOption).toBeUndefined();
      });

      it("should work with conditionalFields in nested arrays", async () => {
        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: ["A", "B"],
                        },
                      },
                      config: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            optionA: { type: FieldTypes.TEXT },
                            optionB: { type: FieldTypes.TEXT },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              A: ["optionA"],
                              B: ["optionB"],
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
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          settings: [
            {
              type: "A",
              config: {
                optionA: "valueA",
                optionB: "valueB",
              },
            },
            {
              type: "B",
              config: {
                optionA: "valueA",
                optionB: "valueB",
              },
            },
          ],
        });

        expect(i.settings?.[0]?.config?.optionA).toBe("valueA");
        expect(i.settings?.[0]?.config?.optionB).toBeUndefined();
        expect(i.settings?.[1]?.config?.optionA).toBeUndefined();
        expect(i.settings?.[1]?.config?.optionB).toBe("valueB");
      });

      it("should apply validators conditionally in nested arrays", async () => {
        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: ["A", "B"],
                        },
                      },
                      config: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            optionA: { type: FieldTypes.TEXT },
                            optionB: { type: FieldTypes.TEXT },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              A: ["optionA"],
                              B: ["optionB"],
                            },
                          },
                          validators: [
                            {
                              type: ValidatorTypes.REQUIRED,
                              options: { field: "optionA" },
                            },
                            {
                              type: ValidatorTypes.REQUIRED,
                              options: { field: "optionB" },
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
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should pass validation
        await expect(
          model.validate([
            {
              settings: [
                {
                  type: "A",
                  config: {
                    optionA: "valueA",
                  },
                },
                {
                  type: "B",
                  config: {
                    optionB: "valueB",
                  },
                },
              ],
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail validation when required fields are missing
        await expect(
          model.validate([
            {
              settings: [
                {
                  type: "A",
                  config: {},
                },
              ],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should ignore validators for unused fields in nested arrays", async () => {
        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: ["A", "B"],
                        },
                      },
                      config: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            optionA: { type: FieldTypes.TEXT },
                            optionB: { type: FieldTypes.TEXT },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              A: ["optionA"],
                              B: ["optionB"],
                            },
                          },
                          validators: [
                            {
                              type: ValidatorTypes.REQUIRED,
                              options: { field: "optionA" },
                            },
                            {
                              type: ValidatorTypes.REQUIRED,
                              options: { field: "optionB" },
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
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should not require optionB when type is A
        await expect(
          model.validate([
            {
              settings: [
                {
                  type: "A",
                  config: {
                    optionA: "valueA",
                  },
                },
              ],
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail when optionA is missing for type A
        await expect(
          model.validate([
            {
              settings: [
                {
                  type: "A",
                  config: {},
                },
              ],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should handle conditionalFields with nested dependsOn paths", async () => {
        const model = mockModel({
          fields: {
            settings: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  mode: {
                    type: FieldTypes.ENUM,
                    options: {
                      enum: ["simple", "complex"],
                    },
                  },
                  config: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        subMode: {
                          type: FieldTypes.ENUM,
                          options: {
                            enum: ["A", "B"],
                          },
                        },
                        options: {
                          type: FieldTypes.OBJECT,
                          options: {
                            strict: true,
                            fields: {
                              optionA: { type: FieldTypes.TEXT },
                              optionB: { type: FieldTypes.TEXT },
                            },
                            conditionalFields: {
                              dependsOn: "$.subMode",
                              mappings: {
                                A: ["optionA"],
                                B: ["optionB"],
                              },
                            },
                          },
                        },
                      },
                      conditionalFields: {
                        dependsOn: "$.mode",
                        mappings: {
                          simple: ["subMode", "options"],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          settings: {
            mode: "simple",
            config: {
              subMode: "A",
              options: {
                optionA: "valueA",
                optionB: "valueB",
              },
            },
          },
        });

        expect(i.settings?.config?.options?.optionA).toBe("valueA");
        expect(i.settings?.config?.options?.optionB).toBeUndefined();
      });

      it("should ignore validators in fields not included by conditionalFields", async () => {
        const model = mockModel({
          fields: {
            paymentMethod: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["creditCard", "paypal"],
              },
            },
            paymentDetails: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  cardNumber: { type: FieldTypes.TEXT },
                  paypalEmail: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "paymentMethod",
                  mappings: {
                    creditCard: ["cardNumber"],
                    paypal: ["paypalEmail"],
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "cardNumber" },
                  },
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "paypalEmail" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        // Should pass when cardNumber is provided for creditCard
        await expect(
          model.validate([
            {
              paymentMethod: "creditCard",
              paymentDetails: {
                cardNumber: "4111111111111111",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail when cardNumber is missing for creditCard
        await expect(
          model.validate([
            {
              paymentMethod: "creditCard",
              paymentDetails: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);

        // Should pass when paypalEmail is provided for paypal
        await expect(
          model.validate([
            {
              paymentMethod: "paypal",
              paymentDetails: {
                paypalEmail: "user@example.com",
              },
            },
          ]),
        ).resolves.toBeTruthy();

        // Should fail when paypalEmail is missing for paypal
        await expect(
          model.validate([
            {
              paymentMethod: "paypal",
              paymentDetails: {},
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should work with multiple levels of conditionalFields", async () => {
        const model = mockModel({
          fields: {
            level1Type: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["typeA", "typeB"],
              },
            },
            level1: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  level2Type: {
                    type: FieldTypes.ENUM,
                    options: {
                      enum: ["subType1", "subType2"],
                    },
                  },
                  level2: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        field1: { type: FieldTypes.TEXT },
                        field2: { type: FieldTypes.NUMBER },
                      },
                      conditionalFields: {
                        dependsOn: "$.level2Type",
                        mappings: {
                          subType1: ["field1"],
                          subType2: ["field2"],
                        },
                      },
                    },
                  },
                },
                conditionalFields: {
                  dependsOn: "level1Type",
                  mappings: {
                    typeA: ["level2Type", "level2"],
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          level1Type: "typeA",
          level1: {
            level2Type: "subType1",
            level2: {
              field1: "value1",
              field2: 100,
            },
          },
        });

        expect(i.level1?.level2?.field1).toBe("value1");
        expect(i.level1?.level2?.field2).toBeUndefined();
      });

      it("should handle missing mappings in conditionalFields", async () => {
        const model = mockModel({
          fields: {
            status: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["active", "inactive", "unknown"],
              },
            },
            details: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  activeField: { type: FieldTypes.TEXT },
                  inactiveField: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "status",
                  mappings: {
                    active: ["activeField"],
                    inactive: ["inactiveField"],
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          status: "unknown",
          details: {
            activeField: "active",
            inactiveField: "inactive",
          },
        });

        expect(i.details?.activeField).toBeUndefined();
        expect(i.details?.inactiveField).toBeUndefined();
      });

      it("should not include any fields when conditionalFields has no default and value is unmapped", async () => {
        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.ENUM,
              options: {
                enum: ["type1", "type2", "type3"],
              },
            },
            data: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  field1: { type: FieldTypes.TEXT },
                  field2: { type: FieldTypes.TEXT },
                },
                conditionalFields: {
                  dependsOn: "type",
                  mappings: {
                    type1: ["field1"],
                    type2: ["field2"],
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const i = model.hydrate({
          type: "type3",
          data: {
            field1: "value1",
            field2: "value2",
          },
        });

        expect(i.data?.field1).toBeUndefined();
        expect(i.data?.field2).toBeUndefined();
      });
    });

    describe("options.defaultField", () => {
      it("should use defaultField by default to serialize", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = vi.fn(() => serializedText);

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: testSerializer,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const i = model.hydrate({ obj: { title: "test" } });

        const obj = i.obj as any;

        expect(obj).toBeInstanceOf(Object);
        expect(obj.title).toEqual(serializedText);
      });

      it("should use defaultField by default to serialize in json", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = vi.fn(() => serializedText);

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class TestFieldText extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: testSerializer,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const i = model.hydrate({ obj: { title: "test" } });

        const json = i.toJSON();

        expect(json.obj).toBeInstanceOf(Object);
        expect(json.obj?.title).toEqual(serializedText);
      });

      it("should use defaultField only for not defined fields", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = vi.fn(() => serializedText);

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class extends Field<FieldTypes.TEXT> {
              serializerMap = {
                [Field.defaultSymbol]: testSerializer,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
                  type: FieldTypes.TEXT,
                },
                fields: {
                  test: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const fakerNumber = parseFloat(faker.random.numeric());
        const i = model.hydrate({ obj: { title: "test", test: fakerNumber } } as object);

        const obj = i.obj as any;

        expect(obj).toBeInstanceOf(Object);
        expect(obj.title).toEqual(serializedText);
        expect(obj.test).toEqual(fakerNumber);
      });

      it("should use defaultField by default to validate", async () => {
        const testValidator = vi.fn(() => Promise.resolve(true));

        const _adapter = mockAdapter({
          fieldsMap: {
            [FieldTypes.TEXT]: class TestFieldText extends Field<FieldTypes.TEXT> {
              validate = testValidator;
              serializerMap = {
                [Field.defaultSymbol]: ({ value }: any) => value,
              };
            },
          },
        });

        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
                  type: FieldTypes.TEXT,
                },
                fields: {
                  test: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: _adapter });
        await model.initialize();

        const fakeNumber = faker.random.numeric();
        const i = model.hydrate({
          obj: { title: "test", title2: "test2", test: fakeNumber },
        } as object);

        expect(i.obj).toBeInstanceOf(Object);
        expect(testValidator).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidator).toBeCalledTimes(2);
      });
    });

    describe("consistency", () => {
      const _testConsistency = (model: typeof Model, obj: JSONType, f = "obj") => {
        const i = model.hydrate({ [f]: obj });

        const obj1 = i.get(f, "json");
        const obj2 = model.hydrate({ [f]: obj1 }).get(f, "json");

        expect(obj1).toEqual(obj2);
      };

      it("should be consistent with nested text field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  title: {
                    type: FieldTypes.TEXT,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          title: faker.lorem.word(),
        });
      });

      it("should be consistent with nested number field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  value: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          value: Math.random(),
        });
      });

      it("should be consistent with nested boolean field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  value: {
                    type: FieldTypes.BOOLEAN,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          value: Math.random() > 0.5,
        });
      });

      it("should be consistent with nested date field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  value: {
                    type: FieldTypes.DATE,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          value: new Date(),
        });
      });

      it("should be consistent with nested identity field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  value: {
                    type: FieldTypes.IDENTITY,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          value: new ObjectId().toString(),
        });
      });

      it("should be consistent with nested relation field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.OBJECT,
              options: {
                fields: {
                  value: {
                    type: FieldTypes.RELATION,
                    options: {
                      ref: "accounts",
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, {
          value: new ObjectId().toString(),
        });
      });

      it("should be consistent with nested array field", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      value: {
                        type: FieldTypes.NUMBER,
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        _testConsistency(model, [
          {
            value: Math.random(),
          },
        ]);
      });

      it("should be consistent with nested array field in nested object", async () => {
        const model = mockModel({
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
                            value: {
                              type: FieldTypes.NUMBER,
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
        await model.initialize();

        _testConsistency(model, {
          arr: [
            {
              value: Math.random(),
            },
          ],
        });
      });

      it("should be consistent with nested array field in nested array", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      arr: {
                        type: FieldTypes.ARRAY,
                        options: {
                          items: {
                            type: FieldTypes.NUMBER,
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
        await model.initialize();

        _testConsistency(model, [
          {
            arr: [Math.random()],
          },
        ]);
      });
    });
  });

  describe("Identity field", () => {
    it("should throw error if is invalid", async () => {
      const model = mockModel({
        fields: {
          identity: {
            type: FieldTypes.IDENTITY,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      await expect(model.create({ identity: "invalid" })).rejects.toThrow(ValidationError);

      await expect(model.create({ identity: "account:test" })).rejects.toThrow(ValidationError);
    });

    it("should not throw error if is valid", async () => {
      const model = mockModel({
        fields: {
          identity: {
            type: FieldTypes.IDENTITY,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      await expect(model.create({ identity: "account:507f191e810c19729de860ea" })).resolves.toBeInstanceOf(model);
    });
  });

  describe("Relation field", () => {
    it("should return valid PromiseModel instance", async () => {
      const model = mockModel({
        fields: {
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: "accounts",
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const _id = String(new ObjectId());
      const i = model.hydrate({ rel: _id });

      expect(i.rel).toBeInstanceOf(PromiseModel);
      expect(i.rel?.model?.getBaseClass()).toBe(Account);
      expect(i.rel?.query).toEqual(_id);
    });

    it("should return null if value is null", async () => {
      const model = mockModel({
        fields: {
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: "accounts",
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      // @ts-ignore
      const i = model.hydrate({ rel: null });

      expect(i.rel).toBe(null);
    });

    it("should return null if value is invalid", async () => {
      const model = mockModel({
        fields: {
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: "accounts",
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ rel: "invalid" });

      expect(() => i.rel).toThrow("Invalid id");
    });

    it("should return string in JSON format", async () => {
      const model = mockModel({
        fields: {
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: "accounts",
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const _id = String(new ObjectId());
      const i = model.hydrate({ rel: _id });

      expect(i.get("rel", "json")).toEqual(_id);
    });
  });

  describe("Array field", () => {
    it("should throw error if is relation with invalid value", async () => {
      const model = mockModel({
        fields: {
          arr: {
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
      await model.initialize();

      await expect(
        model.create({
          arr: ["507f191e810c19729de860ea", "invalid"],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("should not throw error if is relation with valid value", async () => {
      const model = mockModel({
        fields: {
          arr: {
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
      await model.initialize();

      await expect(
        model.create({
          arr: ["507f191e810c19729de860ea"],
        }),
      ).resolves.toBeInstanceOf(model);
    });

    it("should return PromiseModelList for relation array with format object", async () => {
      const model = mockModel({
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
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrRel: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
      });

      expect(i.arrRel).toBeInstanceOf(PromiseModelList);
      expect(i.arrRel?.model?.getBaseClass()).toBe(Account);
      expect(i.arrRel?.query).toEqual({
        ids: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
      });
    });

    it("should fallback to default field if field not found and strict is false", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.OBJECT,
            options: {
              strict: false, // Default value
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        obj: {
          nested1: {
            nested2: {
              foo: "bar",
            },
          },
        },
      });

      // @ts-expect-error test
      expect(i.obj?.nested1.nested2.foo).toBe("bar");
      expect(i.get("obj.nested1.nested2.foo")).toBe("bar");
      expect(i.get("obj.nested1.nested2")).toEqual({ foo: "bar" });
      expect(i.get("obj.nested1.nested2.foo.bar")).toBe(undefined);
    });

    it("should return array of ids for relation array with format json", async () => {
      const model = mockModel({
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
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrRel: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
      });

      const jsonArrRel = i.get("arrRel", "json");

      expect(jsonArrRel).toBeInstanceOf(Array);
      expect(jsonArrRel).toEqual(["507f191e810c19729de860ea", "507f191e810c19729de860eb"]);
    });

    it("should return array of objects for json field", async () => {
      const model = mockModel({
        fields: {
          arrJson: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrJson: [{ test: "test" }, { test2: "test2" }],
      });

      expect(i.arrJson).toBeInstanceOf(Array);
      expect(i.arrJson).toEqual([{ test: "test" }, { test2: "test2" }]);
    });

    it("should return array from non-array with json field", async () => {
      const model = mockModel({
        fields: {
          arrJson: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrJson: { test: "test" },
      } as object);

      expect(i.arrJson).toBeInstanceOf(Array);
      expect(i.arrJson).toEqual([{ test: "test" }]);
    });

    it("should return serialized item from index", async () => {
      const model = mockModel({
        fields: {
          arrJson: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.OBJECT,
                options: {
                  strict: true,
                  fields: {
                    title: {
                      type: FieldTypes.TEXT,
                    },
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrJson: [{ title: 1, test: "1" }, { title: 2, test: "2" }, "invalid", { title: 3, test: "3" }],
      } as object);

      expect(i.get("arrJson.[0].title")).toEqual("1");
      expect(i.get("arrJson.[0].test")).toBe(undefined);

      expect(i.get("arrJson.[1].title")).toEqual("2");
      expect(i.get("arrJson.[1].test")).toBe(undefined);

      expect(i.get("arrJson.[2].title")).toBe(undefined);
      expect(i.get("arrJson.[2].test")).toBe(undefined);

      expect(i.get("arrJson.[3].title")).toEqual("3");
      expect(i.get("arrJson.[3].test")).toBe(undefined);
    });

    it("should return serialized item from index within array", async () => {
      const model = mockModel({
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
        },
      }).extend({ adapterClass: adapter });

      await model.initialize();

      const ids = Array.from({ length: 3 }, () => new ObjectId().toString());

      const i = model.hydrate({
        arrRel: ids,
      });

      expect(i.get("arrRel")).toBeInstanceOf(PromiseModelList);
      const arr = i.get("arrRel.[]") as any;
      expect(arr).toBeInstanceOf(Array);
      expect(arr.every((i: any) => i instanceof PromiseModel)).toBeTruthy();

      const first = i.get("arrRel.[0]") as any;
      expect(first).toBeInstanceOf(PromiseModel);
      expect(first.query).toEqual(ids[0]);

      const second = i.get("arrRel.[1]") as any;
      expect(second).toBeInstanceOf(PromiseModel);
      expect(second.query).toEqual(ids[1]);

      const third = i.get("arrRel.[2]") as any;
      expect(third).toBeInstanceOf(PromiseModel);
      expect(third.query).toEqual(ids[2]);

      const fourth = i.get("arrRel.[3]") as any;
      expect(fourth).toBe(undefined);
    });

    it("should be able to set a default value", async () => {
      const model = mockModel({
        fields: {
          arr: {
            type: FieldTypes.ARRAY,
            options: {
              default: [],
              items: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      await model.initialize();

      const i = model.hydrate({});

      expect(i.arr).toBeInstanceOf(Array);
    });

    describe("options.distinct", () => {
      it("should be able to use duplicates values by default", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(model.validate([{ arr: ["test", "test", "test2"] }])).resolves.toBeTruthy();
      });

      it("should detect duplicates values", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: ["test", "test", "test2"],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should be able to use distinct values", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: ["test", "test2"],
            },
          ]),
        ).resolves.toBeTruthy();
      });

      it("should be able to use distinct values with nested array", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.TEXT,
                    },
                    distinct: true,
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [
                ["test", "test2"],
                ["test2", "test3"],
              ],
            },
          ]),
        ).resolves.toBeTruthy();
      });

      it("should be able to use distinct values with nested array in nested array", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      arr: {
                        type: FieldTypes.ARRAY,
                        options: {
                          items: {
                            type: FieldTypes.TEXT,
                          },
                          distinct: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [{ arr: ["test", "test2"] }, { arr: ["test2", "test3"] }],
            },
          ]),
        ).resolves.toBeTruthy();
      });

      it("should detect duplicates values with nested array in nested array", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      arr: {
                        type: FieldTypes.ARRAY,
                        options: {
                          items: {
                            type: FieldTypes.TEXT,
                          },
                          distinct: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [{ arr: ["test", "test2"] }, { arr: ["test2", "test2"] }],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values in relation array", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: "accounts",
                  },
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: ["507f191e810c19729de860ea", "507f191e810c19729de860ea"],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values in nested array", async () => {
        const model = mockModel({
          fields: {
            arr: {
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
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [
                ["test", "test2"],
                ["test", "test2"],
              ],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values in nested json array", async () => {
        const model = mockModel({
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
                      },
                    },
                  },
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [{ title: "test" }, { title: "test" }],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values with number values", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.NUMBER,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [1, 2, 2, 3],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values with boolean values", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.BOOLEAN,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(
          model.validate([
            {
              arr: [true, false, true],
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values with date values", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.DATE,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        const date1 = new Date("2023-06-01");
        const date2 = new Date("2023-06-02");

        await expect(model.validate([{ arr: [date1, date2, date1] }])).rejects.toThrow(ValidationError);
      });

      it("should detect duplicates values with mixed types", async () => {
        const model = mockModel({
          fields: {
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.TEXT,
                },
                distinct: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(model.validate([{ arr: ["test", 123, true, "test"] }])).rejects.toThrow(ValidationError);
      });
    });

    describe("Validation", () => {
      it("should validate field values", async () => {
        const model = mockModel({
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
                      },
                    },
                  },
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await model.initialize();

        await expect(model.validate([{ arr: [{ title: "test" }, { title: "test" }] }])).resolves.toBeTruthy();
        await expect(model.validate([{ arr: true }])).rejects.toThrow(ValidationError);
        await expect(model.validate([{ arr: [true] }])).rejects.toThrow(ValidationError);
      });
    });
  });

  describe("Integer field", () => {
    it("should return default value if undefined", async () => {
      const defaultValue = parseInt(faker.random.numeric(), 10);

      const model = mockModel({
        fields: {
          value: {
            type: FieldTypes.INTEGER,
            options: {
              default: defaultValue,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({});
      expect(i.value).toEqual(defaultValue);
    });

    it("should parse string value to integer", async () => {
      const model = mockModel({
        fields: {
          value: {
            type: FieldTypes.INTEGER,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const value = "123";
      const i = model.hydrate({ value });
      expect(i.value).toEqual(123);
    });

    it("should parse float value to integer", async () => {
      const model = mockModel({
        fields: {
          value: {
            type: FieldTypes.INTEGER,
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const value = 123.45;
      const i = model.hydrate({ value });
      expect(i.value).toEqual(123);
    });
  });

  describe("Enum field", () => {
    it("should return default value if undefined", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];
      const defaultValue = enumValues[0];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
              default: defaultValue,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({});
      expect(i.status).toEqual(defaultValue);
    });

    it("should return value if it matches enum", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];
      const value = enumValues[1];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ status: value });
      expect(i.status).toEqual(value);
    });

    it("should return undefined if value does not match enum", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ status: "invalid" });
      expect(i.status).toBeUndefined();
    });

    it("should throw validation error if value does not match enum", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ status: "invalid" });
      await expect(model.validate([i.getData()])).rejects.toThrow(ValidationError);
    });

    it("should throw validation error if value is an ObjectId", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ status: String(new ObjectId()) });
      await expect(model.validate([i.getData()])).rejects.toThrow(ValidationError);
    });

    it("should convert array value to string", async () => {
      const enumValues = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];
      const value = enumValues[0];

      const model = mockModel({
        fields: {
          status: {
            type: FieldTypes.ENUM,
            options: {
              enum: enumValues,
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({ status: [value] });
      expect(i.status).toEqual(value);
    });
  });
});
