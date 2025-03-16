import { mockAdapter, mockModel, generateRandomString } from "@/lib/test-utils.dev.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ValidationError } from "@/lib/validation-error.js";
import { faker } from "@faker-js/faker";
import { PropertyTypes } from "@/enums/property-types.js";
import { Model } from "@/lib/model.js";
import { Validator } from "@/lib/validator.js";
import { ValidatorOptions, ModelJSON } from "@/types/index.js";
import { DataModel } from "@/models/data-model.js";

describe("test validators", () => {
  const adapter = mockAdapter();
  const DataModel_ = DataModel.extend({ adapterClass: adapter });

  describe("required validator", () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        title: {
          type: PropertyTypes.TEXT,
        },
        obj: {
          type: PropertyTypes.OBJECT,
          properties: {
            title: {
              type: PropertyTypes.TEXT,
            },
          },
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
    }).extend({ adapterClass: adapter });

    beforeAll(async () => {
      await model.initialize();
    });

    const _containsValidator = (e: ValidationError) => {
      return e.validators.some(err => {
        const v = err.validator as Validator<ValidatorTypes.REQUIRED>;
        return v.type === ValidatorTypes.REQUIRED && v.options.property === "title";
      });
    };

    describe("create", () => {
      it("create without property title should throw error", async () => {
        expect.assertions(2);

        try {
          await model.create({});
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("create with property title should not throw error", async () => {
        const title = faker.lorem.word();
        const i = await model.create({ title });
        expect(i).toBeInstanceOf(model);
      });

      it("create with null or empty property title should throw error", async () => {
        expect.assertions(2);

        try {
          await model.create({ title: undefined });
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });
    });

    describe("createMultiple", () => {
      it("createMultiple without property title in list should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();

        try {
          await model.createMultiple([{}, { title }]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("createMultiple with property title in every item of list should not throw error", async () => {
        const title = faker.lorem.word();
        const list = await model.createMultiple([{ title }, { title }]);
        expect(list).toBeInstanceOf(Array);
        expect(list.every(i => i instanceof model)).toBeTruthy();
      });

      it("createMultiple with one null or empty property title in list should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();

        try {
          await model.createMultiple([{ title }, { title: undefined }]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("createMultiple with nested property title in every item of list should not throw error", async () => {
        const title = faker.lorem.word();
        const list = await model.createMultiple([
          { title, obj: { title } },
          { title, obj: { title } },
        ]);
        expect(list).toBeInstanceOf(Array);
        expect(list.every(i => i instanceof model)).toBeTruthy();
      });
    });

    describe("update prototype", () => {
      it("update title property to null should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();
        const i = await model.create({ title });

        try {
          await i.update({ $set: { title: null } });
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("unset title property should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();
        const i = await model.create({ title });

        try {
          await i.update({ $unset: { title: true } });
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("update title property should not throw error", async () => {
        const title = faker.lorem.word();
        const i = await model.create({ title });

        const updateTitle = faker.lorem.word();
        await i.update({ $set: { title: updateTitle } });
        expect((i.getData() as any).title).toBe(updateTitle);
      });
    });

    describe("update model", () => {
      it("update title property on model to null should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();
        const i = await model.create({ title });

        try {
          const _model = model as typeof Model;
          await _model.update({ filter: { _id: i._id as string } }, { $set: { title: null } });
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("unset title property on model should throw error", async () => {
        expect.assertions(2);
        const title = faker.lorem.word();
        const i = await model.create({ title });

        try {
          const _model = model as typeof Model;
          await _model.update({ filter: { _id: i._id as string } }, { $unset: { title: true } });
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("update title property on model should not throw error", async () => {
        const title = faker.lorem.word();
        const updateTitle = faker.lorem.word();
        const i = await model.create({ title });

        const _model = model as typeof Model;
        const res = await _model.update({ filter: { _id: i._id as string } }, { $set: { title: updateTitle } });

        expect(res).toBeInstanceOf(Array);
        expect(res.every(i => i instanceof _model)).toBeTruthy();
      });
    });

    describe("validate", () => {
      it("should throw error if no property", async () => {
        expect.assertions(2);

        try {
          await model.validate([{}]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("should throw error if property is empty string", async () => {
        expect.assertions(2);

        try {
          await model.validate([{ title: "" }]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("should throw error if property is specified as undefined", async () => {
        expect.assertions(2);

        try {
          await model.validate([{ title: undefined }]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("should throw error if property is null", async () => {
        expect.assertions(2);

        try {
          await model.validate([{ title: undefined }]);
        } catch (_e) {
          const e = _e as ValidationError;
          expect(e).toBeInstanceOf(ValidationError);
          expect(_containsValidator(e)).toBeTruthy();
        }
      });

      it("should not throw error if property is valid", async () => {
        const title = faker.lorem.word();
        const validated = await model.validate([{ title }]);
        expect(validated).toBeTruthy();
      });

      it("should validate within array", async () => {
        const _model = mockModel({
          slug: faker.random.alphaNumeric(10),
          properties: {
            arr: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.TEXT,
              },
              validators: [
                {
                  type: ValidatorTypes.REQUIRED,
                },
              ],
            },
          },
        }).extend({ adapterClass: adapter });

        await expect(
          _model.validate([
            {
              arr: [faker.lorem.word()],
            },
          ]),
        ).resolves.toBeTruthy();

        await expect(
          _model.validate([
            {
              arr: [faker.lorem.word(), ""],
            },
          ]),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });
  });

  describe("regex validator", () => {
    const _mockModelWithRegexValidator = async (options: Partial<ValidatorOptions<ValidatorTypes.REGEX>> = {}) => {
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          {
            type: ValidatorTypes.REGEX,
            options: {
              property: "title",
              ...options,
            } as ValidatorOptions<ValidatorTypes.REGEX>,
          },
        ],
      }).extend({ adapterClass: adapter });

      await model.initialize();

      return model;
    };

    describe("email regex", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({
          pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
        });
      });

      it("create with valid email should not throw error", async () => {
        const i = await model.create({ title: faker.internet.email() });

        expect(i).toBeInstanceOf(model);
      });

      it("create with undefined email should not throw error", async () => {
        const i = await model.create({});

        expect(i).toBeInstanceOf(model);
      });

      it("create with null email should not throw error", async () => {
        const i = await model.create({ title: undefined });

        expect(i).toBeInstanceOf(model);
      });

      it("create with invalid email should throw error", async () => {
        const invalidPromise = model.create({ title: "invalidEmail" });

        await expect(invalidPromise).rejects.toBeInstanceOf(ValidationError);
      });
    });

    describe("url regex", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({
          pattern: "^https?:\\/\\/.+",
        });
      });

      it("create with valid url should not throw error", async () => {
        const i = await model.create({ title: faker.internet.url() });

        expect(i).toBeInstanceOf(model);
      });

      it("create with undefined url should not throw error", async () => {
        const i = await model.create({});

        expect(i).toBeInstanceOf(model);
      });

      it("create with null url should not throw error", async () => {
        const i = await model.create({ title: undefined });

        expect(i).toBeInstanceOf(model);
      });

      it("create with invalid url should throw error", async () => {
        const invalidPromise = model.create({ title: "invalidUrl" });

        await expect(invalidPromise).rejects.toBeInstanceOf(ValidationError);
      });
    });

    it("should validate within array", async () => {
      const _model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          arr: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.TEXT,
            },
            validators: [
              {
                type: ValidatorTypes.REGEX,
                options: {
                  pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
                },
              },
            ],
          },
        },
      }).extend({ adapterClass: adapter });

      await expect(
        _model.validate([
          {
            arr: [faker.internet.email()],
          },
        ]),
      ).resolves.toBeTruthy();

      await expect(
        _model.validate([
          {
            arr: [faker.internet.email(), "invalidEmail"],
          },
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("keyProperty validator", () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        title: {
          type: PropertyTypes.TEXT,
        },
      },
      validators: [
        {
          type: ValidatorTypes.KEY_PROPERTY,
          options: {
            property: "title",
          },
        },
      ],
    }).extend({ adapterClass: adapter });

    beforeAll(async () => {
      await model.initialize();
    });

    it("create with no keyProperty should throw error", async () => {
      await expect(model.create({})).rejects.toBeInstanceOf(ValidationError);
    });

    it("create with valid keyProperty should not throw error", async () => {
      const i = await model.create({ title: "validKey" });
      expect(i).toBeInstanceOf(model);
    });

    it("create with invalid format keyProperty should throw error", async () => {
      await expect(model.create({ title: "invalid key" })).rejects.toBeInstanceOf(ValidationError);
    });

    it("create multiple with duplicated keyProperty should throw error", async () => {
      await expect(model.createMultiple([{ title: "test" }, { title: "test" }])).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe("datamodelKeyProperty validator", () => {
    it("datamodel without keyProperty should not throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await expect(datamodel).resolves.toBeInstanceOf(DataModel);
    });

    it("datamodel with keyProperty and valid keyProperty property should not throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        keyProperty: "title",
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await expect(datamodel).resolves.toBeInstanceOf(DataModel);
    });

    it("datamodel with keyProperty and not existing property should throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        keyProperty: "title",
      });

      await expect(datamodel).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with keyProperty and invalid keyProperty property should throw error", async () => {
      const datamodel1 = DataModel_.create({
        slug: generateRandomString(),
        keyProperty: "test",
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await expect(datamodel1).rejects.toBeInstanceOf(ValidationError);

      const datamodel2 = DataModel_.create({
        slug: generateRandomString(),
        keyProperty: "title",
        properties: {
          title: {
            type: PropertyTypes.TEXT,
            options: {
              default: "default",
            },
          },
        },
      });

      await expect(datamodel2).rejects.toBeInstanceOf(ValidationError);

      const datamodel3 = DataModel_.create({
        slug: generateRandomString(),
        keyProperty: "title",
        properties: {
          title: {
            type: PropertyTypes.NUMBER,
          },
        },
      });

      await expect(datamodel3).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("datamodelDefinition validator", () => {
    it("datamodel with invalid property name should throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        properties: {
          "invalid name": {
            type: PropertyTypes.TEXT,
          },
        },
      });

      await expect(datamodel).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with invalid property type should throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        properties: {
          title: {
            // @ts-expect-error invalid type
            type: "invalid type",
          },
        },
      });

      await expect(datamodel).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with invalid property options should throw error", async () => {
      const datamodel = DataModel_.create({
        slug: generateRandomString(),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
            options: "invalid options",
          },
        },
      });

      await expect(datamodel).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with valid property name should not throw", async () => {
      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            validname: {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).resolves.toBeTruthy();

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            "valid:name": {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).resolves.toBeTruthy();

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            "valid-name": {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).resolves.toBeTruthy();

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            valid_name: {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).resolves.toBeTruthy();
    });

    it("datamodel with invalid property name should throw error", async () => {
      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            "invalid name": {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            "invalid.name": {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            "invalid!name": {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            _invalidName: {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with property name as reserved keyword should throw error", async () => {
      const _create = async (properties: ModelJSON<typeof DataModel>["properties"]) => {
        return DataModel_.create({
          slug: generateRandomString(),
          properties,
        });
      };

      await expect(
        _create({
          _id: {
            type: PropertyTypes.TEXT,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        _create({
          model: {
            type: PropertyTypes.TEXT,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        _create({
          getData: {
            type: PropertyTypes.TEXT,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        _create({
          get: {
            type: PropertyTypes.TEXT,
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with property name longer than 100 characters should throw error", async () => {
      const propertyName = "a".repeat(101);
      await expect(
        DataModel_.create({
          slug: generateRandomString(),
          properties: {
            [propertyName]: {
              type: PropertyTypes.TEXT,
            },
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("datamodel with more than 100 properties should throw error", async () => {
      const _createModelWithProperties = async (propertiesCount: number) => {
        const properties: ModelJSON<typeof DataModel>["properties"] = {};
        for (let i = 0; i < propertiesCount; i++) {
          properties[`property${i}`] = {
            type: PropertyTypes.TEXT,
          };
        }

        return DataModel_.create({
          slug: generateRandomString(),
          properties,
        });
      };

      await expect(_createModelWithProperties(99)).resolves.toBeInstanceOf(DataModel);
      await expect(_createModelWithProperties(100)).resolves.toBeInstanceOf(DataModel);
      await expect(_createModelWithProperties(101)).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("length validator", () => {
    const _mockModelWithRegexValidator = async (options: Partial<ValidatorOptions<ValidatorTypes.LENGTH>> = {}) => {
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          {
            type: ValidatorTypes.LENGTH,
            options: {
              property: "title",
              ...options,
            },
          },
        ],
      }).extend({ adapterClass: adapter });

      await model.initialize();

      return model;
    };

    it("create without validator config should not throw error", async () => {
      const model = await _mockModelWithRegexValidator();

      await expect(model.create({})).resolves.toBeInstanceOf(model);

      await expect(model.create({ title: "test" })).resolves.toBeInstanceOf(model);

      await expect(model.create({ title: "" })).resolves.toBeInstanceOf(model);

      await expect(model.create({ title: faker.lorem.paragraph() })).resolves.toBeInstanceOf(model);
    });

    it("should validate in nested array", async () => {
      const _model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          arr: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.OBJECT,
                properties: {
                  nested: {
                    type: PropertyTypes.ARRAY,
                    items: {
                      type: PropertyTypes.TEXT,
                    },
                    validators: [
                      {
                        type: ValidatorTypes.LENGTH,
                        options: {
                          min: 2,
                          max: 3,
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      }).extend({ adapterClass: adapter });

      await expect(
        _model.create({
          arr: [
            [
              {
                nested: ["12"],
              },
            ],
            [
              {
                nested: ["123", "123", "123", "123"],
              },
            ],
          ],
        }),
      ).resolves.toBeInstanceOf(_model);

      await expect(
        _model.create({
          arr: [
            [
              {
                nested: ["1"],
              },
              {
                nested: ["123"],
              },
            ],
          ],
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        _model.create({
          arr: [
            [
              {
                nested: ["12"],
              },
              {
                nested: ["123"],
              },
            ],
          ],
        }),
      ).resolves.toBeInstanceOf(_model);
    });

    describe("min", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ min: 2 });
      });

      it("invalid length should throw error", async () => {
        await expect(model.create({ title: "" })).rejects.toThrow(ValidationError);

        // @ts-expect-error test
        await expect(model.create({ title: 1 })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        await expect(model.create({ title: "ab" })).resolves.toBeInstanceOf(model);

        await expect(model.create({ title: faker.lorem.paragraph() })).resolves.toBeInstanceOf(model);
      });
    });

    describe("max", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ max: 5 });
      });

      it("invalid length should throw error", async () => {
        await expect(model.create({ title: "123456" })).rejects.toThrow(ValidationError);

        // @ts-expect-error test
        await expect(model.create({ title: 123456 })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        await expect(model.create({ title: "test" })).resolves.toBeInstanceOf(model);

        await expect(model.create({ title: "12345" })).resolves.toBeInstanceOf(model);

        // @ts-expect-error test
        await expect(model.create({ title: 12345 })).resolves.toBeInstanceOf(model);
      });
    });

    describe("min and max", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ min: 2, max: 5 });
      });

      it("invalid length should throw error", async () => {
        await expect(model.create({ title: "" })).rejects.toThrow(ValidationError);

        // @ts-expect-error test
        await expect(model.create({ title: 1 })).rejects.toThrow(ValidationError);

        await expect(model.create({ title: "123456" })).rejects.toThrow(ValidationError);

        // @ts-expect-error test
        await expect(model.create({ title: 123456 })).rejects.toThrow(ValidationError);

        await expect(model.create({ title: faker.lorem.paragraph() })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        await expect(model.create({ title: "ab" })).resolves.toBeInstanceOf(model);

        await expect(model.create({ title: "test" })).resolves.toBeInstanceOf(model);

        await expect(model.create({ title: "12345" })).resolves.toBeInstanceOf(model);

        // @ts-expect-error test
        await expect(model.create({ title: 12345 })).resolves.toBeInstanceOf(model);
      });
    });

    describe("on array", () => {
      const _mockModelWithArrayProperty = async (options: Partial<ValidatorOptions<ValidatorTypes.LENGTH>> = {}) => {
        const model = mockModel({
          slug: faker.random.alphaNumeric(10),
          properties: {
            arr: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.TEXT,
              },
            },
          },
          validators: [
            {
              type: ValidatorTypes.LENGTH,
              options: {
                property: "arr",
                ...options,
              },
            },
          ],
        }).extend({ adapterClass: adapter });

        await model.initialize();

        return model;
      };

      it("create without validator config should not throw error", async () => {
        const model = await _mockModelWithArrayProperty();

        await expect(model.create({})).resolves.toBeInstanceOf(model);

        await expect(model.create({ arr: [] })).resolves.toBeInstanceOf(model);

        await expect(model.create({ arr: ["test"] })).resolves.toBeInstanceOf(model);

        await expect(model.create({ arr: ["test", "test"] })).resolves.toBeInstanceOf(model);

        await expect(model.create({ arr: ["test", "test", "test"] })).resolves.toBeInstanceOf(model);
      });

      it("create with undefined should not throw error", async () => {
        const model = await _mockModelWithArrayProperty({ min: 2 });

        await expect(model.create({ arr: undefined })).resolves.toBeInstanceOf(model);

        await expect(model.create({ arr: ["test", "test"] })).resolves.toBeInstanceOf(model);
      });

      it("create with invalid length should throw error", async () => {
        const model = await _mockModelWithArrayProperty({ min: 2 });

        await expect(model.create({ arr: [] })).rejects.toThrow(ValidationError);

        await expect(model.create({ arr: ["test"] })).rejects.toThrow(ValidationError);

        await expect(model.create({ arr: ["test", "test"] })).resolves.toBeInstanceOf(model);
      });

      it("create with invalid length should throw error", async () => {
        const model = await _mockModelWithArrayProperty({ max: 2 });

        await expect(model.create({ arr: ["test", "test", "test"] })).rejects.toThrow(ValidationError);

        await expect(model.create({ arr: ["test", "test"] })).resolves.toBeInstanceOf(model);
      });

      it("should validate in nested array", async () => {
        const _model = mockModel({
          slug: faker.random.alphaNumeric(10),
          properties: {
            arr: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.ARRAY,
                items: {
                  type: PropertyTypes.OBJECT,
                  properties: {
                    nested: {
                      type: PropertyTypes.ARRAY,
                      items: {
                        type: PropertyTypes.TEXT,
                      },
                    },
                  },
                  validators: [
                    {
                      type: ValidatorTypes.LENGTH,
                      options: {
                        property: "nested",
                        min: 2,
                        max: 3,
                      },
                    },
                  ],
                },
              },
            },
          },
        }).extend({ adapterClass: adapter });

        await expect(
          _model.create({
            arr: [
              [
                {
                  nested: ["test", "test"],
                },
              ],
              [
                {
                  nested: ["test", "test", "test"],
                },
              ],
            ],
          }),
        ).resolves.toBeInstanceOf(_model);

        await expect(
          _model.create({
            arr: [
              [
                {
                  nested: ["test", "test"],
                },
                {
                  nested: ["test", "test"],
                },
              ],
            ],
          }),
        ).resolves.toBeInstanceOf(_model);

        await expect(
          _model.create({
            arr: [
              [
                {
                  nested: ["test"],
                },
                {
                  nested: ["test", "test"],
                },
              ],
            ],
          }),
        ).rejects.toThrow(ValidationError);

        await expect(
          _model.create({
            arr: [
              [
                {
                  nested: ["1", "2", "3", "4"],
                },
              ],
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe("boundaries validator", () => {
    const _mockModelWithRegexValidator = async (options: Partial<ValidatorOptions<ValidatorTypes.BOUNDARIES>> = {}) => {
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          {
            type: ValidatorTypes.BOUNDARIES,
            options: {
              property: "title",
              ...options,
            },
          },
        ],
      }).extend({ adapterClass: adapter });

      await model.initialize();

      return model;
    };

    it("create without validator config should not throw error", async () => {
      const model = await _mockModelWithRegexValidator();

      await expect(model.create({})).resolves.toBeInstanceOf(model);
      await expect(model.create({ title: "-10" })).resolves.toBeInstanceOf(model);
      await expect(model.create({ title: "100" })).resolves.toBeInstanceOf(model);
      await expect(model.create({ title: "0" })).resolves.toBeInstanceOf(model);
      await expect(model.create({ title: "0.1" })).resolves.toBeInstanceOf(model);
    });

    describe("min", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ min: 2 });
      });

      it("invalid length should throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: 1 })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: 2 })).resolves.toBeInstanceOf(model);
        // @ts-expect-error test
        await expect(model.create({ title: 3 })).resolves.toBeInstanceOf(model);
      });
    });

    describe("max", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ max: 5 });
      });

      it("invalid length should throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: 6 })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: 2 })).resolves.toBeInstanceOf(model);
        // @ts-expect-error test
        await expect(model.create({ title: 3 })).resolves.toBeInstanceOf(model);
      });
    });

    describe("min and max", () => {
      let model: Awaited<ReturnType<typeof _mockModelWithRegexValidator>>;

      beforeAll(async () => {
        model = await _mockModelWithRegexValidator({ min: 2, max: 5 });
      });

      it("invalid length should throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: -Infinity })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: -1 })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: 1 })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: 1.99999999999 })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: 5.000000001 })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: 6 })).rejects.toThrow(ValidationError);
        // @ts-expect-error test
        await expect(model.create({ title: Infinity })).rejects.toThrow(ValidationError);
      });

      it("valid length should not throw error", async () => {
        // @ts-expect-error test
        await expect(model.create({ title: 2 })).resolves.toBeInstanceOf(model);
        // @ts-expect-error test
        await expect(model.create({ title: 3 })).resolves.toBeInstanceOf(model);
      });
    });
  });

  describe("unique validator", () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        title: {
          type: PropertyTypes.TEXT,
        },
        arr: {
          type: PropertyTypes.ARRAY,
          items: {
            type: PropertyTypes.TEXT,
          },
          validators: [
            {
              type: ValidatorTypes.UNIQUE,
            },
          ],
        },
        arrObj: {
          type: PropertyTypes.ARRAY,
          items: {
            type: PropertyTypes.OBJECT,
            properties: {
              label: {
                type: PropertyTypes.TEXT,
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
          validators: [
            {
              type: ValidatorTypes.UNIQUE,
            },
          ],
        },
      },
      validators: [
        {
          type: ValidatorTypes.UNIQUE,
          options: {
            property: "title",
          },
        },
      ],
    }).extend({ adapterClass: adapter });

    beforeAll(async () => {
      await model.initialize();
    });

    it("no value should not throw error", async () => {
      const list = await model.createMultiple([{}, {}]);
      expect(list).toBeInstanceOf(Array);
    });

    it("same value should throw error", async () => {
      await expect(
        model.createMultiple([
          {
            title: "title",
          },
          {
            title: "title",
          },
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("same value in array should throw error", async () => {
      await expect(
        model.create({
          arr: ["value", "value"],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("same value in nested array property should throw error", async () => {
      await expect(
        model.create({
          arrObj: [
            {
              label: "value",
            },
            {
              label: "value",
            },
          ],
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("same value in array in different instances should throw error", async () => {
      await expect(
        model.createMultiple([
          {
            arr: ["value1", "value2"],
          },
          {
            arr: ["value3", "value1"],
          },
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("same value in nested array property in different instances should throw error", async () => {
      await expect(
        model.createMultiple([
          {
            arrObj: [
              {
                label: "value1",
              },
              {
                label: "value2",
              },
            ],
          },
          {
            arrObj: [
              {
                label: "value3",
              },
              {
                label: "value1",
              },
            ],
          },
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("length and required validators", () => {
    describe("on text property", () => {
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          title: {
            type: PropertyTypes.TEXT,
          },
        },
        validators: [
          {
            type: ValidatorTypes.LENGTH,
            options: {
              property: "title",
              min: 2,
              max: 5,
            },
          },
          {
            type: ValidatorTypes.REQUIRED,
            options: {
              property: "title",
            },
          },
        ],
      }).extend({ adapterClass: adapter });

      beforeAll(async () => {
        await model.initialize();
      });

      it("no value should throw error", async () => {
        await expect(model.create({})).rejects.toBeInstanceOf(ValidationError);
      });

      it("null value should throw error", async () => {
        await expect(model.create({ title: undefined })).rejects.toBeInstanceOf(ValidationError);
      });

      it("invalid length should throw error", async () => {
        await expect(model.create({ title: "1" })).rejects.toBeInstanceOf(ValidationError);
        await expect(model.create({ title: "123456" })).rejects.toBeInstanceOf(ValidationError);
      });

      it("valid length should not throw error", async () => {
        await expect(model.create({ title: "12" })).resolves.toBeInstanceOf(model);
        await expect(model.create({ title: "12345" })).resolves.toBeInstanceOf(model);
      });
    });

    describe("on array property", () => {
      const model = mockModel({
        slug: faker.random.alphaNumeric(10),
        properties: {
          arr: {
            type: PropertyTypes.ARRAY,
            items: {
              type: PropertyTypes.TEXT,
            },
          },
        },
        validators: [
          {
            type: ValidatorTypes.LENGTH,
            options: {
              property: "arr",
              min: 2,
              max: 3,
            },
          },
          {
            type: ValidatorTypes.REQUIRED,
            options: {
              property: "arr",
            },
          },
        ],
      }).extend({ adapterClass: adapter });

      beforeAll(async () => {
        await model.initialize();
      });

      it("no value should throw error", async () => {
        await expect(model.create({})).rejects.toBeInstanceOf(ValidationError);
      });

      // it("null value should throw error", async () => {
      //   await expect(model.create({ arr: null })).rejects.toBeInstanceOf(ValidationError);
      // });

      it("invalid length should throw error", async () => {
        await expect(model.create({ arr: [] })).rejects.toBeInstanceOf(ValidationError);
        await expect(model.create({ arr: ["1"] })).rejects.toBeInstanceOf(ValidationError);
        await expect(model.create({ arr: ["1", "2", "3", "4"] })).rejects.toBeInstanceOf(ValidationError);
      });

      it("valid length should not throw error", async () => {
        await expect(model.create({ arr: ["1", "2"] })).resolves.toBeInstanceOf(model);
        await expect(model.create({ arr: ["1", "2", "3"] })).resolves.toBeInstanceOf(model);
      });
    });
  });
});
