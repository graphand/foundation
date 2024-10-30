import { FieldTypes } from "@/enums/field-types.js";
import { mockModel } from "./test-utils.dev.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ValidationError } from "./ValidationError.js";

describe("ValidationError", () => {
  it("should create a ValidationError", async () => {
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
    });

    const error = await model.validate([{ enum: "e" }]).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fieldsPaths).toEqual(["enum"]);

    const errorsOnPath = error.onPath("enum");
    expect(errorsOnPath).toHaveLength(2);
  });
});
