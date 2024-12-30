import { FieldTypes } from "@/enums/field-types.js";
import { FieldSerializerInput } from "@/index.js";
import { Field } from "@/lib/field.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class FieldText extends Field<FieldTypes.TEXT> {
  validate: Field<FieldTypes.TEXT>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (this.options.enum?.length && this.options.strict && !this.options.enum.includes(String(v))) {
        throw new Error(`value does not match strict enum`);
      }

      if (isObjectId(v)) {
        throw new Error(`value is an ObjectId. Text fields do not accept ObjectId values`);
      }
    });

    return true;
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
