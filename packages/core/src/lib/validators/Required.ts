import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { getValidationValues } from "../utils.ts";

export class ValidatorRequired extends Validator<ValidatorTypes.REQUIRED> {
  validate: Validator<ValidatorTypes.REQUIRED>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath());

    if (!values?.length) return true;

    return !values.some(v => [null, undefined, ""].includes(v as string));
  };
}
