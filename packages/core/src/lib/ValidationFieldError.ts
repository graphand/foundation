import { ValidationFieldErrorDefinition } from "@/types/index.ts";

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
    validationError: ReturnType<NonNullable<ValidationFieldError["validationError"]>["toJSON"]> | undefined;
  } {
    return {
      slug: this.slug,
      field: this.field?.toJSON(),
      validationError: this.validationError?.toJSON(),
    };
  }
}
