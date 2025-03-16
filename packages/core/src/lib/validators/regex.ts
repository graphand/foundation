import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { getValidationValues } from "../utils.js";
import { ValidationValidatorError } from "../validation-validator-error.js";

export class ValidatorRegex extends Validator<ValidatorTypes.REGEX> {
  validate: Validator<ValidatorTypes.REGEX>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath() as string).filter(
      v => ![null, undefined].includes(v as any),
    );

    if (!values?.length) return true;

    const { pattern, options } = this.definition;
    const regex = new RegExp(pattern, options?.join(""));

    values.forEach(v => {
      if (!regex.test(v as string)) {
        throw new ValidationValidatorError({
          validator: this,
          message: `value does not match pattern ${pattern}`,
          value: v,
        });
      }
    });

    return true;
  };
}
