import { ValidationValidatorErrorDefinition } from "@/types/index.js";
import { Validator } from "./validator.js";

export class ValidationValidatorError {
  #definition: ValidationValidatorErrorDefinition;

  constructor(definition: ValidationValidatorErrorDefinition) {
    this.#definition = definition;
  }

  get validator() {
    return this.#definition.validator;
  }

  get value() {
    return this.#definition.value;
  }

  get message() {
    return this.#definition.message;
  }

  toJSON() {
    return {
      type: "ValidationValidatorError",
      validator: this.validator.toJSON(),
      value: this.value,
      message: this.message,
    };
  }

  static fromJSON(json: ReturnType<ValidationValidatorError["toJSON"]>) {
    const { type, validator, value, message } = json;

    if (type !== "ValidationValidatorError") {
      throw new Error("Invalid JSON");
    }

    return new ValidationValidatorError({ validator: Validator.fromJSON(validator), value, message });
  }
}
