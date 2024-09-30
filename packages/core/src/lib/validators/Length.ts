import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { getValidationValues } from "../utils.ts";

export class ValidatorLength extends Validator<ValidatorTypes.LENGTH> {
  validate: Validator<ValidatorTypes.LENGTH>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const { min, max } = this.options;

    return !values.some(v => {
      let length = (v as string)?.length ?? 0;

      if (typeof v === "number") {
        length = String(v).length;
      }

      if (min !== undefined && length < min) {
        return true;
      }

      if (max !== undefined && length > max) {
        return true;
      }

      return false;
    });
  };
}
