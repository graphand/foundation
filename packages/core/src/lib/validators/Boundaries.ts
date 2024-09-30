import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { getValidationValues } from "../utils.ts";

export class ValidatorBoundaries extends Validator<ValidatorTypes.BOUNDARIES> {
  validate: Validator<ValidatorTypes.BOUNDARIES>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const { min, max } = this.options;

    return !values.some(v => {
      const num = Array.isArray(v) ? v.length : parseFloat(v as string);

      if (min !== undefined && num < min) {
        return true;
      }

      if (max !== undefined && num > max) {
        return true;
      }

      return false;
    });
  };
}
