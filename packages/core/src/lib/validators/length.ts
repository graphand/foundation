import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { getValidationValues } from "../utils.js";
import { ValidationValidatorError } from "../validation-validator-error.js";

export class ValidatorLength extends Validator<ValidatorTypes.LENGTH> {
  validate: Validator<ValidatorTypes.LENGTH>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath() as string).filter(
      v => ![null, undefined].includes(v as any),
    );

    if (!values?.length) return true;

    const { min, max } = this.definition;

    values.forEach(v => {
      let length = (v as string)?.length ?? 0;

      if (typeof v === "number") {
        length = String(v).length;
      }

      if (min !== undefined && length < min) {
        throw new ValidationValidatorError({
          validator: this,
          message: `length is less than min ${min}`,
          value: v,
        });
      }

      if (max !== undefined && length > max) {
        throw new ValidationValidatorError({
          validator: this,
          message: `length is greater than max ${max}`,
          value: v,
        });
      }
    });

    return true;
  };
}
