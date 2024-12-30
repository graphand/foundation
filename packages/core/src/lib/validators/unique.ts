import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { getValidationValues } from "../utils.js";
import { ValidationValidatorError } from "../validation-validator-error.js";

export class ValidatorUnique extends Validator<ValidatorTypes.UNIQUE> {
  validate: Validator<ValidatorTypes.UNIQUE>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(
      v => ![null, undefined, ""].includes(v as string),
    );

    if (!values?.length) {
      return true;
    }

    const valueSet = new Set();
    values.forEach(v => {
      if (valueSet.has(v)) {
        throw new ValidationValidatorError({
          validator: this,
          message: `value ${v} is duplicated`,
          value: v,
        });
      }

      valueSet.add(v);
    });

    return true;
  };
}
