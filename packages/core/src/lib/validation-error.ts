import { CoreError } from "@/lib/core-error.js";
import { ValidationPropertyError } from "@/lib/validation-property-error.js";
import { ValidationValidatorError } from "@/lib/validation-validator-error.js";
import { CoreErrorDefinition } from "@/types/index.js";
import { ErrorCodes } from "@/enums/error-codes.js";

export class ValidationError extends CoreError {
  properties: Array<ValidationPropertyError>;
  validators: Array<ValidationValidatorError>;
  model?: string;

  constructor({
    properties,
    validators,
    model,
    ...coreDefinition
  }: CoreErrorDefinition & {
    properties?: Array<ValidationPropertyError>;
    validators?: Array<ValidationValidatorError>;
    model?: string;
  }) {
    super(coreDefinition);

    this.properties = properties ?? [];
    this.validators = validators ?? [];
    this.model = model;

    Object.defineProperty(this, "message", {
      enumerable: true,
      value: this.message,
    });
    Object.defineProperty(this, "propertiesPaths", {
      enumerable: true,
      value: this.propertiesPaths,
    });
  }

  get code() {
    return ErrorCodes.VALIDATION_FAILED;
  }

  get propertiesPaths(): Array<string> {
    return Array.from(
      new Set(
        [...this.properties.map(f => f.property?.path), ...this.validators.map(v => v.validator.getFullPath())].filter(
          Boolean,
        ) as Array<string>,
      ),
    );
  }

  get message() {
    let message = `Validation failed`;

    const reasons = [];
    if (this.properties.length) {
      let reason: string;

      if (this.properties.length > 1) {
        reason = `${this.properties.length} properties validators`;
      } else {
        reason = "a property validator";
      }

      reason += ` (${this.properties.map(v => v.property.type).join(", ")})`;

      reasons.push(reason);
    }

    const paths = Array.from(new Set(this.propertiesPaths || [])).filter(Boolean);
    if (paths?.length) {
      message += ` on path${paths.length > 1 ? "s" : ""} ${paths.join(", ")}`;
    }

    if (this.model) {
      message += ` on model ${this.model}`;
    }

    if (this.validators.length) {
      let reason: string;

      if (this.validators.length > 1) {
        reason = `${this.validators.length} model validators`;
      } else {
        reason = `a model validator`;
      }

      const values = this.validators.filter(v => v.value !== undefined).map(v => v.value);
      if (values.length) {
        reason += ` for value${values.length > 1 ? "s" : ""} ${values.join(", ")}`;
      }

      const messages = this.validators.filter(v => v.message).map(v => v.message);
      if (messages.length) {
        reason += `: ${messages.join()}`;
      }

      const types = this.validators.map(v => v.validator.type).join(", ");
      if (types) {
        reason += ` (${types})`;
      }

      reasons.push(reason);
    }

    if (reasons.length) {
      message += ` with ${reasons.join(" and ")}`;
    }

    return message;
  }

  get type() {
    return "ValidationError";
  }

  onPath(path: string) {
    return [
      ...this.properties.filter(f => f.property?.path === path),
      ...this.validators.filter(v => v.validator.getFullPath() === path),
    ];
  }

  forPath = this.onPath;

  toJSON() {
    const json = {
      ...super.toJSON(),
      type: this.type,
      model: this.model,
      reason: {
        properties: this.properties.map(f => f.toJSON()),
        validators: this.validators.map(v => v.toJSON()),
      },
      propertiesPaths: this.propertiesPaths,
    };

    return json;
  }

  static fromJSON(json: ReturnType<ValidationError["toJSON"]>): ValidationError {
    if (json.type !== "ValidationError") {
      throw new Error("Invalid JSON");
    }

    const { message, model, reason } = json;
    const properties = reason.properties.map(f => ValidationPropertyError.fromJSON(f));
    const validators = reason.validators.map(v => ValidationValidatorError.fromJSON(v));

    return new ValidationError({
      message,
      properties,
      validators,
      model,
    });
  }

  static isValidationError(error: unknown): error is ValidationError {
    return (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "ValidationError" &&
      error.constructor &&
      Object.getPrototypeOf(error.constructor).prototype?.type === "CoreError"
    );
  }
}
