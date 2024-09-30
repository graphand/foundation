import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { getValidationValues } from "../utils.ts";

export class ValidatorUnique extends Validator<ValidatorTypes.UNIQUE> {
  validate: Validator<ValidatorTypes.UNIQUE>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.getFullPath()).filter(
      v => ![null, undefined, ""].includes(v as string),
    );

    if (!values?.length) {
      return true;
    }

    const valueSet = new Set();
    const hasTwice = values.some(v => {
      if (valueSet.has(v)) {
        return true;
      }

      valueSet.add(v);
      return false;
    });

    if (hasTwice) {
      return false;
    }

    return true;
  };
}
