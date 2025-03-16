import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { getValidationValues } from "../utils.js";
import { ValidationValidatorError } from "../validation-validator-error.js";

export class ValidatorBoundaries extends Validator<ValidatorTypes.BOUNDARIES> {
  validate: Validator<ValidatorTypes.BOUNDARIES>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath() as string).filter(
      v => ![null, undefined].includes(v as any),
    );

    if (!values?.length) return true;

    const { min, max } = this.definition;

    values.forEach(v => {
      const num = Array.isArray(v) ? v.length : parseFloat(v as string);

      if (min !== undefined && num < min) {
        throw new ValidationValidatorError({
          validator: this,
          message: `value ${v} is lower than min ${min}`,
          value: v,
        });
      }

      if (max !== undefined && num > max) {
        throw new ValidationValidatorError({
          validator: this,
          message: `value ${v} is higher than max ${max}`,
          value: v,
        });
      }
    });

    return true;
  };
}
