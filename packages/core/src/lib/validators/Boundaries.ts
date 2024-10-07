import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/Validator.js";
import { getValidationValues } from "../utils.js";

export class ValidatorBoundaries extends Validator<ValidatorTypes.BOUNDARIES> {
  validate: Validator<ValidatorTypes.BOUNDARIES>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const { min, max } = this.options;

    values.forEach(v => {
      const num = Array.isArray(v) ? v.length : parseFloat(v as string);

      if (min !== undefined && num < min) {
        throw new Error(`value ${v} is lower than min ${min}`);
      }

      if (max !== undefined && num > max) {
        throw new Error(`value ${v} is higher than max ${max}`);
      }
    });

    return true;
  };
}
