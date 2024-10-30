import { CoreError } from "@/lib/CoreError.js";
import { ValidationFieldError } from "@/lib/ValidationFieldError.js";
import { ValidationValidatorError } from "@/lib/ValidationValidatorError.js";
import { CoreErrorDefinition } from "@/types/index.js";
import { ErrorCodes } from "@/enums/error-codes.js";

export class ValidationError extends CoreError {
  fields: Array<ValidationFieldError>;
  validators: Array<ValidationValidatorError>;
  model?: string;

  constructor({
    fields,
    validators,
    model,
    ...coreDefinition
  }: CoreErrorDefinition & {
    fields?: Array<ValidationFieldError>;
    validators?: Array<ValidationValidatorError>;
    model?: string;
  }) {
    super(coreDefinition);

    this.fields = fields ?? [];
    this.validators = validators ?? [];
    this.model = model;

    Object.defineProperty(this, "message", {
      enumerable: true,
      value: this.message,
    });
    Object.defineProperty(this, "fieldsPaths", {
      enumerable: true,
      value: this.fieldsPaths,
    });
  }

  get code() {
    return ErrorCodes.VALIDATION_FAILED;
  }

  get fieldsPaths(): Array<string> {
    return Array.from(
      new Set(
        [...this.fields.map(f => f.field?.path), ...this.validators.map(v => v.validator.getFullPath())].filter(
          Boolean,
        ),
      ),
    );
  }

  get message() {
    let message = `Validation failed`;

    const reasons = [];
    if (this.fields.length) {
      let reason: string;

      if (this.fields.length > 1) {
        reason = `${this.fields.length} fields validators`;
      } else {
        reason = "a field validator";
      }

      reason += ` (${this.fields.map(v => v.field.type).join(", ")})`;

      reasons.push(reason);
    }

    const paths = Array.from(new Set(this.fieldsPaths || [])).filter(Boolean);
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
      ...this.fields.filter(f => f.field?.path === path),
      ...this.validators.filter(v => v.validator.getFullPath() === path),
    ];
  }

  forPath(path: string) {
    return [
      ...this.fields.filter(f => f.field?.path === path),
      ...this.validators.filter(v => v.validator.getFullPath() === path),
    ];
  }

  toJSON() {
    const json = {
      ...super.toJSON(),
      type: this.type,
      model: this.model,
      reason: {
        fields: this.fields.map(f => f.toJSON()),
        validators: this.validators.map(v => v.toJSON()),
      },
      fieldsPaths: this.fieldsPaths,
    };

    return json;
  }

  static fromJSON(json: ReturnType<ValidationError["toJSON"]>): ValidationError {
    if (json.type !== "ValidationError") {
      throw new Error("Invalid JSON");
    }

    const { message, model, reason } = json;
    const fields = reason.fields.map(f => ValidationFieldError.fromJSON(f));
    const validators = reason.validators.map(v => ValidationValidatorError.fromJSON(v));

    return new ValidationError({
      message,
      fields,
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
