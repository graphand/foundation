import { ValidationError } from "./ValidationError.js";
import { ValidationFieldError } from "./ValidationFieldError.js";
import { ValidationValidatorError } from "./ValidationValidatorError.js";
import { Field } from "./Field.js";
import { Validator } from "./Validator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { mockAdapter, mockModel } from "./test-utils.dev.js";
import { ErrorCodes } from "@/enums/error-codes.js";

describe("ValidationError", () => {
  const adapterClass = mockAdapter();

  it("should create ValidationError with empty fields and validators", () => {
    const error = new ValidationError({});
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fields).toEqual([]);
    expect(error.validators).toEqual([]);
    expect(error.model).toBeUndefined();
    expect(error.message).toBe("Validation failed");
  });

  it("should return correct message when no fields or validators", () => {
    const error = new ValidationError({});
    expect(error.message).toBe("Validation failed");
  });

  it("should return correct message with multiple fields and validators", () => {
    const field1 = new Field({ type: FieldTypes.TEXT }, "field1");
    const field2 = new Field({ type: FieldTypes.NUMBER }, "field2");

    const fieldError1 = new ValidationFieldError({
      slug: "field1",
      field: field1,
    });
    const fieldError2 = new ValidationFieldError({
      slug: "field2",
      field: field2,
    });

    const validator1 = new Validator({
      type: ValidatorTypes.REGEX,
      options: { field: "field1", pattern: "^d$" },
    });
    validator1.getFullPath = () => "field1";

    const validator2 = new Validator({
      type: ValidatorTypes.LENGTH,
      options: { field: "field2", min: 5 },
    });
    validator2.getFullPath = () => "field2";

    const validatorError1 = new ValidationValidatorError({
      validator: validator1,
    });
    const validatorError2 = new ValidationValidatorError({
      validator: validator2,
    });

    const error = new ValidationError({
      fields: [fieldError1, fieldError2],
      validators: [validatorError1, validatorError2],
      model: "TestModel",
    });

    expect(error.message).toContain("Validation failed");
    expect(error.message).toContain("2 fields validators");
    expect(error.message).toContain("2 model validators");
    expect(error.message).toContain("on paths field1, field2");
    expect(error.message).toContain("on model TestModel");
  });

  it("should return correct fieldsPaths with multiple fields", () => {
    const field1 = new Field({ type: FieldTypes.TEXT }, "field1");
    const field2 = new Field({ type: FieldTypes.NUMBER }, "field2");

    const fieldError1 = new ValidationFieldError({
      slug: "field1",
      field: field1,
    });
    const fieldError2 = new ValidationFieldError({
      slug: "field2",
      field: field2,
    });

    const error = new ValidationError({
      fields: [fieldError1, fieldError2],
    });

    expect(error.fieldsPaths).toEqual(["field1", "field2"]);
  });

  it("should return correct code", () => {
    const error = new ValidationError({});
    expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it("should return errors on existing path using onPath", () => {
    const field = new Field({ type: FieldTypes.TEXT }, "field1");

    const fieldError = new ValidationFieldError({
      slug: "field1",
      field: field,
    });

    const validator = new Validator({
      type: ValidatorTypes.REGEX,
      options: { field: "field1", pattern: "^d$" },
    });
    validator.getFullPath = () => "field1";

    const validatorError = new ValidationValidatorError({
      validator: validator,
    });

    const error = new ValidationError({
      fields: [fieldError],
      validators: [validatorError],
    });

    const errorsOnPath = error.onPath("field1");
    expect(errorsOnPath).toHaveLength(2);
    expect(errorsOnPath).toContain(fieldError);
    expect(errorsOnPath).toContain(validatorError);
  });

  it("should return empty array for non-existing path using onPath", () => {
    const field = new Field({ type: FieldTypes.TEXT }, "field1");

    const fieldError = new ValidationFieldError({
      slug: "field1",
      field: field,
    });

    const error = new ValidationError({
      fields: [fieldError],
    });

    const errorsOnPath = error.onPath("nonExistingPath");
    expect(errorsOnPath).toHaveLength(0);
  });

  it("should correctly serialize and deserialize with toJSON and fromJSON", () => {
    const fieldError = new ValidationFieldError({
      slug: "field1",
      field: new Field({ type: FieldTypes.TEXT }, "field1"),
    });
    const validatorError = new ValidationValidatorError({
      validator: new Validator({
        type: ValidatorTypes.REGEX,
        options: { field: "field1", pattern: "^d$" },
      }),
    });
    validatorError.validator.getFullPath = () => "field1";

    const error = new ValidationError({
      fields: [fieldError],
      validators: [validatorError],
      model: "TestModel",
      message: "Custom message",
    });

    const json = error.toJSON();
    const restoredError = ValidationError.fromJSON(json);
    expect(restoredError).toBeInstanceOf(ValidationError);
    expect(restoredError.message).toBe(error.message);
    expect(restoredError.model).toBe(error.model);
    expect(restoredError.fieldsPaths).toEqual(error.fieldsPaths);
    expect(restoredError.fields).toHaveLength(error.fields.length);
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
    expect(error.fields).toEqual([]);
    expect(error.validators).toEqual([]);
    expect(error.fieldsPaths).toEqual([]);
  });

  it("should work with simple model and enum field", async () => {
    const model = mockModel({
      fields: {
        enum: {
          type: FieldTypes.TEXT,
          options: {
            strict: true,
            enum: ["a", "b", "c"],
          },
        },
      },
      validators: [{ type: ValidatorTypes.REGEX, options: { field: "enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    const error = await model.validate([{ enum: "e" }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fieldsPaths).toEqual(["enum"]);

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

  it("should work with nested model and enum field", async () => {
    const model = mockModel({
      fields: {
        obj: {
          type: FieldTypes.OBJECT,
          options: {
            fields: {
              enum: {
                type: FieldTypes.TEXT,
                options: {
                  strict: true,
                  enum: ["a", "b", "c"],
                },
              },
            },
          },
        },
      },
      validators: [{ type: ValidatorTypes.REGEX, options: { field: "obj.enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    const error = await model.validate([{ obj: { enum: "e" } }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fieldsPaths).toEqual(["obj.enum"]);

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

  it("should work with nested model and array of enum fields", async () => {
    const model = mockModel({
      fields: {
        obj: {
          type: FieldTypes.OBJECT,
          options: {
            fields: {
              array: {
                type: FieldTypes.ARRAY,
                options: {
                  items: {
                    type: FieldTypes.OBJECT,
                    options: {
                      fields: {
                        enum: {
                          type: FieldTypes.TEXT,
                          options: {
                            strict: true,
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
      validators: [{ type: ValidatorTypes.REGEX, options: { field: "obj.array.[].enum", pattern: "^d$" } }],
    }).extend({ adapterClass });

    const error = await model.validate([{ obj: { array: [{ enum: "e" }] } }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fieldsPaths).toEqual(["obj.array.[].enum"]);

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
