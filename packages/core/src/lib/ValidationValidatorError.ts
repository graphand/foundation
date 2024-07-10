import { ValidationValidatorErrorDefinition } from "@/types";

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

  toJSON() {
    return {
      validator: this.validator.toJSON(),
      value: this.value,
    };
  }
}
