import { ValidationFieldErrorDefinition } from "@/types";

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

  toJSON(): {
    slug: string;
    field: ReturnType<ValidationFieldError["field"]["toJSON"]>;
    validationError: ReturnType<ValidationFieldError["validationError"]["toJSON"]>;
  } {
    return {
      slug: this.slug,
      field: this.field?.toJSON(),
      validationError: this.validationError?.toJSON(),
    };
  }
}
