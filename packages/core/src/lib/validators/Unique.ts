import { ValidatorTypes } from "@/enums/validator-types";
import { Validator } from "@/lib/Validator";
import { getValidationValues } from "../utils";

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
