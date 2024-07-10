import { ValidatorTypes } from "@/enums/validator-types";
import { Validator } from "@/lib/Validator";
import { getValidationValues } from "../utils";

export class ValidatorRegex extends Validator<ValidatorTypes.REGEX> {
  validate: Validator<ValidatorTypes.REGEX>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(
      v => ![null, undefined].includes(v),
    );

    if (!values?.length) return true;

    const regex = new RegExp(this.options.pattern, this.options.options?.join(""));

    return !values.some(v => !regex.test(v as string));
  };
}
