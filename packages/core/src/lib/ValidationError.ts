import { CoreError } from "@/lib/CoreError.ts";
import { ValidationFieldError } from "@/lib/ValidationFieldError.ts";
import { ValidationValidatorError } from "@/lib/ValidationValidatorError.ts";
import { CoreErrorDefinition } from "@/types/index.ts";
import { ErrorCodes } from "@/enums/error-codes.ts";

export class ValidationError extends CoreError {
  fields: Array<ValidationFieldError>;
  validators: Array<ValidationValidatorError>;

  constructor({
    fields,
    validators,
    ...coreDefinition
  }: CoreErrorDefinition & {
    fields?: Array<ValidationFieldError>;
    validators?: Array<ValidationValidatorError>;
  }) {
    super(coreDefinition);

    this.fields = fields ?? [];
    this.validators = validators ?? [];

    Object.defineProperty(this, "fieldsPaths", {
      enumerable: true,
      value: this.fieldsPaths,
    });
  }

  get code() {
    return ErrorCodes.VALIDATION_FAILED;
  }

  get fieldsPaths(): Array<string> {
    return [...this.fields.map(f => f.field?.path), ...this.validators.map(v => v.validator.getFullPath())];
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
    if (this.validators.length) {
      let reason = `${this.validators.length} model validator${this.validators.length > 1 ? "s" : ""} (${this.validators
        .map(v => v.validator.type)
        .join(", ")})`;

      const values = this.validators.filter(v => v.value !== undefined).map(v => v.value);
      if (values.length) {
        reason += ` for value${values.length > 1 ? "s" : ""} ${values.join(", ")}`;
      }

      reasons.push(reason);
    }

    if (reasons.length) {
      message += ` with ${reasons.join(" and ")}`;
    }

    if (this.fieldsPaths?.length) {
      const paths = Array.from(new Set(this.fieldsPaths));
      message += ` on path${paths.length > 1 ? "s" : ""} ${paths.join(", ")}`;
    }

    return message;
  }

  toJSON() {
    const json = {
      ...super.toJSON(),
      type: "ValidationError",
      fieldsPaths: this.fieldsPaths,
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
