import { FieldTypes } from "@/enums/field-types.js";
import { FieldSerializerInput } from "@/index.js";
import { Field } from "@/lib/Field.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class FieldEnum extends Field<FieldTypes.ENUM> {
  validate: Field<FieldTypes.ENUM>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);
    const enums = this.options.enum ?? [];

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (!enums.includes(String(v))) {
        throw new Error(`value does not match enum`);
      }

      if (isObjectId(v)) {
        throw new Error(`value is an ObjectId. Enum fields do not accept ObjectId values`);
      }
    });

    return true;
  };

  _sDefault = ({ value }: FieldSerializerInput) => {
    const single = Array.isArray(value) ? String(value[0]) : String(value);
    const enums = this.options.enum ?? [];

    return enums.includes(single) ? single : undefined;
  };

  serializerMap: Field<FieldTypes.ENUM>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this._sDefault,
  };
}
