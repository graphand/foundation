import { FieldTypes } from "@/enums/field-types.js";
import { IdentityTypes } from "@/enums/identity-types.js";
import { Field } from "@/lib/Field.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class FieldIdentity extends Field<FieldTypes.IDENTITY> {
  validate: Field<FieldTypes.IDENTITY>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => {
      if (v === null || v === undefined) {
        return false;
      }

      const [type, id] = String(v).split(":");

      return !Object.values(IdentityTypes).includes(type as IdentityTypes) || !isObjectId(id);
    };
    const vs = getValidationValues(list, this.path);

    return !vs.some(_isInvalid);
  };

  serializerMap: Field<FieldTypes.IDENTITY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => String(value),
  };
}
