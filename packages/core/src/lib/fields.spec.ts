import { ObjectId } from "bson";
import { generateRandomString, mockAdapter, mockModel } from "@/lib/test-utils.dev";
import { FieldTypes } from "@/enums/field-types";
import { faker } from "@faker-js/faker";
import { Field } from "@/lib/Field";
import { Validator } from "@/lib/Validator";
import { ValidatorTypes } from "@/enums/validator-types";
import { ValidationError } from "@/lib/ValidationError";
import { PromiseModel } from "@/lib/PromiseModel";
import { Account, DataModel, JSONType, Model } from "@/index";
import { PromiseModelList } from "@/lib/PromiseModelList";

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

    describe("options.enum", () => {
      it("should return value within enum", async () => {
        const _enum = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: _enum,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = _enum[0];

        const i = model.hydrate({ title });
        expect(i.title).toEqual(title);
      });

      it("should return value not in enum if strict mode is not enabled", async () => {
        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = "notInEnum";

        const i = model.hydrate({ title });
        expect(i.title).toEqual(title);
      });

      it("should return value within enum if value is valid & strict mode is enabled", async () => {
        const _enum = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: _enum,
                strict: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = _enum[0];

        const i = model.hydrate({ title });
        expect(i.title).toEqual(title);
      });

      it("should return null if value not in enum and strict mode is enabled", async () => {
        const _enum = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: _enum,
                strict: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = "notInEnum";

        const i = model.hydrate({ title });
        expect(i.title).toEqual(undefined);
      });

      it("should not throw error if value is in _enum and strict mode is enabled", async () => {
        const _enum = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: _enum,
                strict: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = _enum[0];

        const i = model.hydrate({ title });
        await expect(model.validate([i.getData()])).resolves.toBeTruthy();
      });

      it("should throw error if value not in enum and strict mode is enabled", async () => {
        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
                strict: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = "notInEnum";

        const i = model.hydrate({ title });
        await expect(model.validate([i.getData()])).rejects.toThrow(ValidationError);
      });

      it("should throw error if value not in enum and strict mode is enabled on create", async () => {
        const model = mockModel({
          fields: {
            title: {
              type: FieldTypes.TEXT,
              options: {
                enum: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()],
                strict: true,
              },
            },
          },
        }).extend({ adapterClass: adapter });
        await model.initialize();

        const title = "notInEnum";

        await expect(model.create({ title })).rejects.toThrow(ValidationError);
      });
    });
  });

  describe("Nested field", () => {
    it("should return default value if undefined", async () => {
      const defaultJSON = { default: true };

      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
            type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
    });

    describe("Proxy", () => {
      it("should return an object proxy", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.NESTED,
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
        expect(i.obj.__isProxy).toBe(true);
      });

      it("should not call other fields serializers thanks to the proxy", async () => {
        const serializeText = jest.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = jest.fn(({ value }) => {
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
              type: FieldTypes.NESTED,
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
        expect(i.obj.title).toBe("test");

        expect(serializeText).toHaveBeenCalledTimes(1);
        expect(serializeNumber).not.toHaveBeenCalled();
      });

      it("should not call other fields serializers thanks to the proxy even in nested objects", async () => {
        const serializeText = jest.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = jest.fn(({ value }) => {
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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  subObj: {
                    type: FieldTypes.NESTED,
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
        expect(i.obj.subObj).toBeInstanceOf(Object);
        expect(i.obj.subObj.title).toBe("test");
        expect(serializeText).toHaveBeenCalledTimes(1);

        expect(i.get("obj.subObj.title")).toBe("test");

        expect(serializeNumber).not.toHaveBeenCalled();
      });

      it("should not call other fields serializers thanks to the proxy even in nested array", async () => {
        const serializeText = jest.fn(({ value }) => {
          return typeof value === "string" ? value : String(value);
        });

        const serializeNumber = jest.fn(({ value }) => {
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
                  type: FieldTypes.NESTED,
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
        expect(i.arr[0]).toBeInstanceOf(Object);
        expect(i.arr[0].title).toBe("test");

        expect(serializeText).toHaveBeenCalledTimes(1);
        expect(serializeNumber).not.toHaveBeenCalled();
      });
    });

    describe("options.strict", () => {
      it("should return only defined fields in options when strict", async () => {
        const model = mockModel({
          fields: {
            obj: {
              type: FieldTypes.NESTED,
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
        const testSerializer = jest.fn(() => serializedText);

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
              type: FieldTypes.NESTED,
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
        expect(i.obj.title).toEqual(serializedText);
      });

      it("should validate fields defined in options", async () => {
        const testValidator = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
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
        const testSerializer = jest.fn(() => serializedText);
        const testValidator = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
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
        expect(i.obj.nested).toBeInstanceOf(Object);
        expect(i.obj.nested.title).toEqual(serializedText);

        expect(testValidator).toBeCalledTimes(0);

        await model.validate([i.getData()]);

        expect(testValidator).toBeCalledTimes(1);
      });

      it("should throw error if error happens in field validation", async () => {
        const testValidator = jest.fn(() => Promise.resolve(false));

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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
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
        const testValidate = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
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
        const testValidate = jest.fn(() => Promise.resolve(false));

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
              type: FieldTypes.NESTED,
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
        const testValidate = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
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
        const testValidate = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
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

    // The option dependsOn allows to define another field of the model that value will be used to determine which sub field to use.
    // This is useful when you have a field that can be of different types depending on another field value.
    // This also filters the validators and serializers to only use the ones defined in the sub field.
    describe("options.dependsOn", () => {
      it("should use dependsOn to determine which field to use", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "type",
                strict: true,
                fields: {
                  text: {
                    type: FieldTypes.TEXT,
                  },
                  number: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        } as const).extend({ adapterClass: _adapter });
        await model.initialize();

        const text = faker.lorem.word();

        const i = model.hydrate({
          type: "text",
          obj: {
            text,
            number: 123,
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj.text).toBe(text);
        expect(i.obj.number).toBeUndefined();
      });

      it("should use dependsOn to determine which field to use in json", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "type",
                strict: true,
                fields: {
                  text: {
                    type: FieldTypes.TEXT,
                  },
                  number: {
                    type: FieldTypes.NUMBER,
                  },
                },
              },
            },
          },
        } as const).extend({ adapterClass: _adapter });
        await model.initialize();

        const text = faker.lorem.word();

        const i = model.hydrate({
          type: "text",
          obj: {
            text,
            number: 123,
          },
        });

        const json = i.toJSON();

        expect(json.obj).toBeInstanceOf(Object);
        expect(json.obj.text).toBe(text);
        expect(json.obj.number).toBeUndefined();
      });

      it("should work with nested fields", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
                    options: {
                      dependsOn: "type",
                      strict: true,
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                        number: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        } as const).extend({ adapterClass: _adapter });
        await model.initialize();

        const text = faker.lorem.word();

        const i = model.hydrate({
          type: "text",
          obj: {
            nested: {
              text,
              number: 123,
            },
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj.nested).toBeInstanceOf(Object);
        expect(i.obj.nested.text).toBe(text);
        expect(i.obj.nested.number).toBeUndefined();
      });

      it("should work in nested arrays", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            arr: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.NESTED,
                  options: {
                    dependsOn: "type",
                    strict: true,
                    fields: {
                      text: {
                        type: FieldTypes.TEXT,
                      },
                      number: {
                        type: FieldTypes.NUMBER,
                      },
                    },
                  },
                },
              },
            },
          },
        } as const).extend({ adapterClass: _adapter });
        await model.initialize();

        const i = model.hydrate({
          type: "text",
          arr: [
            {
              text: "text1",
              number: 123,
            },
            {
              text: "text2",
              number: 123,
            },
          ],
        });

        expect(i.arr).toBeInstanceOf(Array);
        expect(i.arr[0]).toBeInstanceOf(Object);
        expect(i.arr[0].text).toBe("text1");
        expect(i.arr[0].number).toBeUndefined();
        expect(i.arr[1]).toBeInstanceOf(Object);
        expect(i.arr[1].text).toBe("text2");
        expect(i.arr[1].number).toBeUndefined();
      });

      it("should work with dependsOn as a key to a nested field", async () => {
        const _adapter = mockAdapter();

        const model = mockModel({
          fields: {
            obj1: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  type: {
                    type: FieldTypes.TEXT,
                    options: {
                      enum: ["text", "number"],
                      strict: true,
                    },
                  },
                },
              },
            },
            obj2: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
                    options: {
                      dependsOn: "obj1.type",
                      strict: true,
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                        number: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        } as const).extend({ adapterClass: _adapter });
        await model.initialize();

        const text = faker.lorem.word();

        const i = model.hydrate({
          obj1: {
            type: "text",
          },
          obj2: {
            nested: {
              text,
              number: 123,
            },
          },
        });

        expect(i.obj2).toBeInstanceOf(Object);
        expect(i.obj2.nested).toBeInstanceOf(Object);
        expect(i.obj2.nested.text).toBe(text);
        expect(i.obj2.nested.number).toBeUndefined();
      });

      it("should validate only the fields defined in the dependsOn field", async () => {
        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "type",
                strict: true,
                fields: {
                  text: {
                    type: FieldTypes.TEXT,
                  },
                  number: {
                    type: FieldTypes.NUMBER,
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "number" }, // This validator should be ignored as it is not in the dependsOn field
                  },
                ],
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.number" }, // This validator should be ignored
            },
          ],
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        await expect(
          model.validate([
            {
              type: "text",
              obj: {
                text: faker.lorem.word(),
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              type: "number",
              obj: {
                text: faker.lorem.word(),
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should validate only the fields defined in the dependsOn field in nested fields", async () => {
        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  nested: {
                    type: FieldTypes.NESTED,
                    options: {
                      dependsOn: "type",
                      strict: true,
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                        number: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "number" }, // This validator should be ignored as it is not in the dependsOn field
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.nested.number" }, // This validator should be ignored
            },
          ],
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        await expect(
          model.validate([
            {
              type: "text",
              obj: {
                nested: {
                  text: faker.lorem.word(),
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              type: "number",
              obj: {
                nested: {
                  text: faker.lorem.word(),
                },
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should validate only the fields defined in the dependsOn field in deeply nested structures", async () => {
        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  level1: {
                    type: FieldTypes.NESTED,
                    options: {
                      dependsOn: "type",
                      strict: true,
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                        number: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                      validators: [
                        {
                          type: ValidatorTypes.REQUIRED,
                          options: { field: "number" }, // This validator should be ignored as it is not in the dependsOn field
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.level1.number" }, // This validator should be ignored
            },
          ],
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        await expect(
          model.validate([
            {
              type: "text",
              obj: {
                level1: {
                  text: faker.lorem.word(),
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              type: "number",
              obj: {
                level1: {
                  text: faker.lorem.word(),
                },
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should ignore validators when the dependsOn value does not match", async () => {
        const model = mockModel({
          fields: {
            type: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["text", "number"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "type",
                strict: true,
                fields: {
                  text: {
                    type: FieldTypes.TEXT,
                  },
                  number: {
                    type: FieldTypes.NUMBER,
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "number" }, // This validator should be ignored as it is not in the dependsOn field
                  },
                ],
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.REQUIRED,
              options: { field: "obj.number" }, // This validator should be ignored
            },
          ],
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        await expect(
          model.validate([
            {
              type: "text",
              obj: {
                text: faker.lorem.word(),
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              type: "number",
              obj: {
                text: faker.lorem.word(),
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });

      it("should ignore validators in nested ignored fields", async () => {
        const model = mockModel({
          fields: {
            target: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["nested1", "nested2"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "target",
                strict: true,
                fields: {
                  nested1: {
                    type: FieldTypes.NESTED,
                    options: {
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                      },
                    },
                  },
                  nested2: {
                    type: FieldTypes.NESTED,
                    options: {
                      fields: {
                        number: {
                          type: FieldTypes.NUMBER,
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

        const text = faker.lorem.word();

        const i = model.hydrate({
          target: "nested1",
          obj: {
            nested1: {
              text,
            },
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj.nested1).toBeInstanceOf(Object);
        expect(i.obj.nested1.text).toBe(text);
        expect(i.obj.nested2).toBeUndefined();

        await expect(
          model.validate([
            {
              target: "nested1",
              obj: {
                nested1: {
                  text,
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();
      });

      it("should still validate the fields in the dependsOn field", async () => {
        const model = mockModel({
          fields: {
            target: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["nested1", "nested2"],
                strict: true,
              },
            },
            obj: {
              type: FieldTypes.NESTED,
              options: {
                dependsOn: "target",
                strict: true,
                fields: {
                  nested1: {
                    type: FieldTypes.NESTED,
                    options: {
                      fields: {
                        text: {
                          type: FieldTypes.TEXT,
                        },
                      },
                    },
                  },
                  nested2: {
                    type: FieldTypes.NESTED,
                    options: {
                      fields: {
                        number: {
                          type: FieldTypes.NUMBER,
                        },
                      },
                    },
                  },
                },
                validators: [
                  {
                    type: ValidatorTypes.REQUIRED,
                    options: { field: "nested1.text" },
                  },
                ],
              },
            },
          },
        }).extend({ adapterClass: mockAdapter() });
        await model.initialize();

        const text = faker.lorem.word();

        const i = model.hydrate({
          target: "nested1",
          obj: {
            nested1: {
              text,
            },
          },
        });

        expect(i.obj).toBeInstanceOf(Object);
        expect(i.obj.nested1).toBeInstanceOf(Object);
        expect(i.obj.nested1.text).toBe(text);
        expect(i.obj.nested2).toBeUndefined();

        await expect(
          model.validate([
            {
              target: "nested1",
              obj: {
                nested1: {
                  text,
                },
              },
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          model.validate([
            {
              target: "nested1",
              obj: {
                nested1: {},
              },
            },
          ]),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe("options.defaultField", () => {
      it("should use defaultField by default to serialize", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = jest.fn(() => serializedText);

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
              type: FieldTypes.NESTED,
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
        const testSerializer = jest.fn(() => serializedText);

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
              type: FieldTypes.NESTED,
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
        expect(json.obj.title).toEqual(serializedText);
      });

      it("should use defaultField only for not defined fields", async () => {
        const serializedText = faker.lorem.word();
        const testSerializer = jest.fn(() => serializedText);

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
              type: FieldTypes.NESTED,
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
        const testValidator = jest.fn(() => Promise.resolve(true));

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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
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
                  type: FieldTypes.NESTED,
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
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  arr: {
                    type: FieldTypes.ARRAY,
                    options: {
                      items: {
                        type: FieldTypes.NESTED,
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
                  type: FieldTypes.NESTED,
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
      expect(i.rel.model?.getBaseClass()).toBe(Account);
      expect(i.rel.query).toEqual(_id);
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

    it("should return valid serialized array from items enum", async () => {
      const _enum = [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()];

      const model = mockModel({
        fields: {
          arrTextWithOpts: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.TEXT,
                options: {
                  enum: _enum,
                  strict: true,
                },
              },
            },
          },
          arrNumbers: {
            type: FieldTypes.ARRAY,
            options: {
              items: {
                type: FieldTypes.NUMBER,
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });
      await model.initialize();

      const i = model.hydrate({
        arrTextWithOpts: ["invalid1", _enum[1], "invalid2"],
        arrNumbers: ["1", "2", "3"],
      } as object);

      expect(i.arrTextWithOpts).toEqual([undefined, _enum[1], undefined]);
      expect(i.arrNumbers).toEqual([1, 2, 3]);
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
      expect(i.arrRel.model?.getBaseClass()).toBe(Account);
      expect(i.arrRel.query).toEqual({
        ids: ["507f191e810c19729de860ea", "507f191e810c19729de860eb"],
      });
    });

    it("should fallback to default field if field not found and strict is false", async () => {
      const model = mockModel({
        fields: {
          obj: {
            type: FieldTypes.NESTED,
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
      expect(i.obj.nested1.nested2.foo).toBe("bar");
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
                type: FieldTypes.NESTED,
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
                type: FieldTypes.NESTED,
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
                type: FieldTypes.NESTED,
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
                  type: FieldTypes.NESTED,
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
                  type: FieldTypes.NESTED,
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
                  type: FieldTypes.NESTED,
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

        // @ts-expect-error dates are not json serialized
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

        // @ts-expect-error dates are not json serialized
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
                  type: FieldTypes.NESTED,
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
        // @ts-expect-error test
        await expect(model.validate([{ arr: true }])).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.validate([{ arr: [true] }])).rejects.toThrow(ValidationError);
      });
    });
  });
});
