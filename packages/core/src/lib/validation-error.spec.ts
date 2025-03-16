import { ValidationError } from "./validation-error.js";
import { ValidationPropertyError } from "./validation-property-error.js";
import { ValidationValidatorError } from "./validation-validator-error.js";
import { Property } from "./property.js";
import { Validator } from "./validator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { mockAdapter, mockModel } from "./test-utils.dev.js";
import { ErrorCodes } from "@/enums/error-codes.js";
import { faker } from "@faker-js/faker";

describe("ValidationError", () => {
  const adapterClass = mockAdapter();

  it("should create ValidationError with empty properties and validators", () => {
    const error = new ValidationError({});
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.properties).toEqual([]);
    expect(error.validators).toEqual([]);
    expect(error.model).toBeUndefined();
    expect(error.message).toBe("Validation failed");
  });

  it("should return correct message when no properties or validators", () => {
    const error = new ValidationError({});
    expect(error.message).toBe("Validation failed");
  });

  it("should return correct message with multiple properties and validators", () => {
    const property1 = new Property({ type: PropertyTypes.TEXT }, "property1");
    const property2 = new Property({ type: PropertyTypes.NUMBER }, "property2");

    const propertyError1 = new ValidationPropertyError({
      slug: "property1",
      property: property1,
    });
    const propertyError2 = new ValidationPropertyError({
      slug: "property2",
      property: property2,
    });

    const validator1 = new Validator({
      type: ValidatorTypes.REGEX,
      options: { property: "property1", pattern: "^d$" },
    });
    validator1.getFullPath = () => "property1";

    const validator2 = new Validator({
      type: ValidatorTypes.LENGTH,
      options: { property: "property2", min: 5 },
    });
    validator2.getFullPath = () => "property2";

    const validatorError1 = new ValidationValidatorError({
      validator: validator1,
    });
    const validatorError2 = new ValidationValidatorError({
      validator: validator2,
    });

    const error = new ValidationError({
      properties: [propertyError1, propertyError2],
      validators: [validatorError1, validatorError2],
      model: "TestModel",
    });

    expect(error.message).toContain("Validation failed");
    expect(error.message).toContain("2 properties validators");
    expect(error.message).toContain("2 model validators");
    expect(error.message).toContain("on paths property1, property2");
    expect(error.message).toContain("on model TestModel");
  });

  it("should return correct propertiesPaths with multiple properties", () => {
    const property1 = new Property({ type: PropertyTypes.TEXT }, "property1");
    const property2 = new Property({ type: PropertyTypes.NUMBER }, "property2");

    const propertyError1 = new ValidationPropertyError({
      slug: "property1",
      property: property1,
    });
    const propertyError2 = new ValidationPropertyError({
      slug: "property2",
      property: property2,
    });

    const error = new ValidationError({
      properties: [propertyError1, propertyError2],
    });

    expect(error.propertiesPaths).toEqual(["property1", "property2"]);
  });

  it("should return correct code", () => {
    const error = new ValidationError({});
    expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it("should return errors on existing path using onPath", () => {
    const property = new Property({ type: PropertyTypes.TEXT }, "property1");

    const propertyError = new ValidationPropertyError({
      slug: "property1",
      property: property,
    });

    const validator = new Validator({
      type: ValidatorTypes.REGEX,
      options: { property: "property1", pattern: "^d$" },
    });
    validator.getFullPath = () => "property1";

    const validatorError = new ValidationValidatorError({
      validator: validator,
    });

    const error = new ValidationError({
      properties: [propertyError],
      validators: [validatorError],
    });

    const errorsOnPath = error.onPath("property1");
    expect(errorsOnPath).toHaveLength(2);
    expect(errorsOnPath).toContain(propertyError);
    expect(errorsOnPath).toContain(validatorError);
  });

  it("should return empty array for non-existing path using onPath", () => {
    const property = new Property({ type: PropertyTypes.TEXT }, "property1");

    const propertyError = new ValidationPropertyError({
      slug: "property1",
      property: property,
    });

    const error = new ValidationError({
      properties: [propertyError],
    });

    const errorsOnPath = error.onPath("nonExistingPath");
    expect(errorsOnPath).toHaveLength(0);
  });

  it("should correctly serialize and deserialize with toJSON and fromJSON", () => {
    const propertyError = new ValidationPropertyError({
      slug: "property1",
      property: new Property({ type: PropertyTypes.TEXT }, "property1"),
    });
    const validatorError = new ValidationValidatorError({
      validator: new Validator({
        type: ValidatorTypes.REGEX,
        options: { property: "property1", pattern: "^d$" },
      }),
    });
    validatorError.validator.getFullPath = () => "property1";

    const error = new ValidationError({
      properties: [propertyError],
      validators: [validatorError],
      model: "TestModel",
      message: "Custom message",
    });

    const json = error.toJSON();
    const restoredError = ValidationError.fromJSON(json);
    expect(restoredError).toBeInstanceOf(ValidationError);
    expect(restoredError.message).toBe(error.message);
    expect(restoredError.model).toBe(error.model);
    expect(restoredError.propertiesPaths).toEqual(error.propertiesPaths);
    expect(restoredError.properties).toHaveLength(error.properties.length);
    expect(restoredError.validators).toHaveLength(error.validators.length);
  });

  it("should correctly identify ValidationError instances using isValidationError", () => {
    const error = new ValidationError({});
    expect(ValidationError.isValidationError(error)).toBe(true);
    expect(ValidationError.isValidationError(new Error())).toBe(false);
  });

  it("should return correct type", () => {
    const error = new ValidationError({});
    expect(error.type).toBe("ValidationError");
  });

  it("should handle missing optional properties", () => {
    const error = new ValidationError({
      message: "Error message",
      model: "TestModel",
    });
    expect(error.message).toContain("Validation failed");
    expect(error.model).toBe("TestModel");
    expect(error.properties).toEqual([]);
    expect(error.validators).toEqual([]);
    expect(error.propertiesPaths).toEqual([]);
  });

  it("should work with simple model and enum property", async () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        enum: {
          type: PropertyTypes.ENUM,
          options: {
            enum: ["a", "b", "c"],
          },
        },
      },
      validators: [{ type: ValidatorTypes.REGEX, options: { property: "enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    // @ts-expect-error
    const error = await model.validate([{ enum: "e" }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.propertiesPaths).toEqual(["enum"]);

    const errorsOnPath = error.onPath("enum");
    expect(errorsOnPath).toHaveLength(2);

    expect(ValidationError.isValidationError(error)).toBe(true);
    expect(ValidationError.isValidationError(new Error())).toBe(false);
    expect(ValidationError.isValidationError(error.toJSON())).toBe(false);

    const json1 = error.toJSON();
    const decoded = ValidationError.fromJSON(json1);
    const json2 = decoded.toJSON();

    expect(json1).toEqual(json2);
  });

  it("should work with nested model and enum property", async () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        obj: {
          type: PropertyTypes.OBJECT,
          options: {
            properties: {
              enum: {
                type: PropertyTypes.ENUM,
                options: {
                  enum: ["a", "b", "c"],
                },
              },
            },
          },
        },
      },
      validators: [{ type: ValidatorTypes.REGEX, options: { property: "obj.enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    // @ts-expect-error
    const error = await model.validate([{ obj: { enum: "e" } }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.propertiesPaths).toEqual(["obj.enum"]);

    const errorsOnPath = error.onPath("obj.enum");
    expect(errorsOnPath).toHaveLength(2);

    expect(ValidationError.isValidationError(error)).toBe(true);
    expect(ValidationError.isValidationError(new Error())).toBe(false);
    expect(ValidationError.isValidationError(error.toJSON())).toBe(false);

    const json1 = error.toJSON();
    const decoded = ValidationError.fromJSON(json1);
    const json2 = decoded.toJSON();

    expect(json1).toEqual(json2);
  });

  it("should work with nested model and array of enum properties", async () => {
    const model = mockModel({
      slug: faker.random.alphaNumeric(10),
      properties: {
        obj: {
          type: PropertyTypes.OBJECT,
          options: {
            properties: {
              array: {
                type: PropertyTypes.ARRAY,
                options: {
                  items: {
                    type: PropertyTypes.OBJECT,
                    options: {
                      properties: {
                        enum: {
                          type: PropertyTypes.ENUM,
                          options: {
                            enum: ["a", "b", "c"],
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
      validators: [{ type: ValidatorTypes.REGEX, options: { property: "obj.array.[].enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    // @ts-expect-error
    const error = await model.validate([{ obj: { array: [{ enum: "e" }] } }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.propertiesPaths).toEqual(["obj.array.[].enum"]);

    const errorsOnPath = error.onPath("obj.array.[].enum");
    expect(errorsOnPath).toHaveLength(2);

    expect(ValidationError.isValidationError(error)).toBe(true);
    expect(ValidationError.isValidationError(new Error())).toBe(false);
    expect(ValidationError.isValidationError(error.toJSON())).toBe(false);

    const json1 = error.toJSON();
    const decoded = ValidationError.fromJSON(json1);
    const json2 = decoded.toJSON();

    expect(json1).toEqual(json2);
  });
});
