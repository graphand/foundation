import { ValidationFieldErrorDefinition } from "@/types/index.js";
import { Field } from "./Field.js";
import { ValidationError } from "./ValidationError.js";

export class ValidationFieldError {
  #definition: ValidationFieldErrorDefinition;

  constructor(definition: ValidationFieldErrorDefinition) {
    this.#definition = definition;
  }

  get slug() {
    return this.#definition.slug;
  }

  get field() {
    return this.#definition.field;
  }

  get validationError() {
    return this.#definition.validationError;
  }

  get message() {
    return this.#definition.message;
  }

  toJSON(): {
    type: "ValidationFieldError";
    slug: string;
    field: ReturnType<NonNullable<ValidationFieldError["field"]>["toJSON"]>;
    validationError: ReturnType<NonNullable<ValidationFieldError["validationError"]>["toJSON"]> | undefined;
    message: string | undefined;
  } {
    return {
      type: "ValidationFieldError",
      slug: this.slug,
      field: this.field.toJSON(),
      validationError: this.validationError?.toJSON(),
      message: this.message,
    };
  }

  static fromJSON(json: ReturnType<ValidationFieldError["toJSON"]>): ValidationFieldError {
    const { type, slug, field, validationError, message } = json;

    if (type !== "ValidationFieldError") {
      throw new Error("Invalid JSON");
    }

    return new ValidationFieldError({
      slug,
      message,
      field: Field.fromJSON(field),
      validationError: validationError && ValidationError.fromJSON(validationError),
    });
  }
}
