import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/Validator.js";
import { getValidationValues } from "../utils.js";

export class ValidatorRegex extends Validator<ValidatorTypes.REGEX> {
  validate: Validator<ValidatorTypes.REGEX>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const regex = new RegExp(this.options.pattern, this.options.options?.join(""));

    values.forEach(v => {
      if (!regex.test(v as string)) {
        throw new Error(`value does not match pattern ${this.options.pattern}`);
      }
    });

    return true;
  };
}
