import { ValidationPropertyErrorDefinition } from "@/types/index.js";
import { Property } from "./property.js";
import { ValidationError } from "./validation-error.js";

export class ValidationPropertyError {
  #definition: ValidationPropertyErrorDefinition;

  constructor(definition: ValidationPropertyErrorDefinition) {
    this.#definition = definition;
  }

  get slug() {
    return this.#definition.slug;
  }

  get property() {
    return this.#definition.property;
  }

  get validationError() {
    return this.#definition.validationError;
  }

  get message() {
    return this.#definition.message;
  }

  toJSON(): {
    type: "ValidationPropertyError";
    slug: string;
    property: ReturnType<NonNullable<ValidationPropertyError["property"]>["toJSON"]>;
    validationError: ReturnType<NonNullable<ValidationPropertyError["validationError"]>["toJSON"]> | undefined;
    message: string | undefined;
  } {
    return {
      type: "ValidationPropertyError",
      slug: this.slug,
      property: this.property.toJSON(),
      validationError: this.validationError?.toJSON(),
      message: this.message,
    };
  }

  static fromJSON(json: ReturnType<ValidationPropertyError["toJSON"]>): ValidationPropertyError {
    const { type, slug, property, validationError, message } = json;

    if (type !== "ValidationPropertyError") {
      throw new Error("Invalid JSON");
    }

    return new ValidationPropertyError({
      slug,
      message,
      property: Property.fromJSON(property),
      validationError: validationError && ValidationError.fromJSON(validationError),
    });
  }
}
