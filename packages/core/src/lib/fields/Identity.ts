import { FieldTypes } from "@/enums/field-types";
import { IdentityTypes } from "@/enums/identity-types";
import { Field } from "@/lib/Field";
import { getValidationValues, isObjectId } from "@/lib/utils";

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
