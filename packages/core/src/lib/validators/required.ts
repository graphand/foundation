import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { getValidationValues } from "../utils.js";

export class ValidatorRequired extends Validator<ValidatorTypes.REQUIRED> {
  validate: Validator<ValidatorTypes.REQUIRED>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath() as string);

    if (!values?.length) return true;

    return !values.some(v => [null, undefined, ""].includes(v as string));
  };
}
