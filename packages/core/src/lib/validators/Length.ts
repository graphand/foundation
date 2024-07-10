import { ValidatorTypes } from "@/enums/validator-types";
import { Validator } from "@/lib/Validator";
import { getValidationValues } from "../utils";

export class ValidatorLength extends Validator<ValidatorTypes.LENGTH> {
  validate: Validator<ValidatorTypes.LENGTH>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(
      v => ![null, undefined].includes(v),
    );

    if (!values?.length) return true;

    const { min, max } = this.options;

    return !values.some(v => {
      let length = (v as string)?.length ?? 0;

      if (typeof v === "number") {
        length = String(v).length;
      }

      return length < min || length > max;
    });
  };
}
