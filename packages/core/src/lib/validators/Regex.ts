import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { getValidationValues } from "../utils.ts";

export class ValidatorRegex extends Validator<ValidatorTypes.REGEX> {
  validate: Validator<ValidatorTypes.REGEX>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const regex = new RegExp(this.options.pattern, this.options.options?.join(""));

    return !values.some(v => !regex.test(v as string));
  };
}
