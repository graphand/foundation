import { FieldTypes } from "@/enums/field-types.js";
import { FieldSerializerInput } from "@/index.js";
import { Field } from "@/lib/Field.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class FieldText extends Field<FieldTypes.TEXT> {
  validate: Field<FieldTypes.TEXT>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => {
      if (v === null || v === undefined) {
        return false;
      }

      if (this.options.enum?.length && this.options.strict) {
        return !this.options.enum.includes(String(v));
      }

      if (isObjectId(v)) {
        return true;
      }

      return false;
    };

    const values = getValidationValues(list, this.path);

    return !values.some(_isInvalid);
  };

  _sDefault = ({ value }: FieldSerializerInput) => {
    const single = Array.isArray(value) ? String(value[0]) : String(value);

    if (this.options.enum?.length && this.options.strict) {
      return this.options.enum.includes(single) ? single : undefined;
    }

    return single;
  };

  serializerMap: Field<FieldTypes.TEXT>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this._sDefault,
  };
}
