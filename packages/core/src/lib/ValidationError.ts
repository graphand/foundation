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
    return [...this.fields.map(f => f.field?.path), ...this.validators.map(v => v.validator.getFullPath())].filter(
      Boolean,
    );
  }

  get message() {
    let message = `Validation failed`;

    const reasons = [];
    if (this.fields.length) {
      reasons.push(
        `${this.fields.length} field${this.fields.length > 1 ? "s" : ""} validators (${this.fields
          .map(v => v.field.type)
          .join(", ")})`,
      );
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

  toJSON() {
    const json = {
      ...super.toJSON(),
      type: "ValidationError",
      fieldsPaths: this.fieldsPaths,
      model: this.model,
      reason: {
        fields: this.fields.map(f => f.toJSON()),
        validators: this.validators.map(v => v.toJSON()),
      },
    };

    if ("code" in json) {
      // @ts-ignore
      delete json.code;
    }

    return json;
  }
}
