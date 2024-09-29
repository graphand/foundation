import { ValidatorTypes } from "@/enums/validator-types";
import { Validator } from "@/lib/Validator";
import { getValidationValues } from "../utils";

export class ValidatorBoundaries extends Validator<ValidatorTypes.BOUNDARIES> {
  validate: Validator<ValidatorTypes.BOUNDARIES>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v));

    if (!values?.length) return true;

    const { min, max } = this.options;

    return !values.some(v => {
      const num = Array.isArray(v) ? v.length : parseFloat(v as string);

      return num < min || num > max;
    });
  };
}
