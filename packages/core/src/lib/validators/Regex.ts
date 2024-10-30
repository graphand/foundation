import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/Validator.js";
import { getValidationValues } from "../utils.js";
import { ValidationValidatorError } from "../ValidationValidatorError.js";

export class ValidatorRegex extends Validator<ValidatorTypes.REGEX> {
  validate: Validator<ValidatorTypes.REGEX>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const regex = new RegExp(this.options.pattern, this.options.options?.join(""));

    values.forEach(v => {
      if (!regex.test(v as string)) {
        throw new ValidationValidatorError({
          validator: this,
          message: `value does not match pattern ${this.options.pattern}`,
          value: v,
        });
      }
    });

    return true;
  };
}
