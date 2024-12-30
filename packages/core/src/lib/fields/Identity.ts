import { FieldTypes } from "@/enums/field-types.js";
import { IdentityTypes } from "@/enums/identity-types.js";
import { Field } from "@/lib/field.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class FieldIdentity extends Field<FieldTypes.IDENTITY> {
  validate: Field<FieldTypes.IDENTITY>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      const [type, id] = String(v).split(":");

      if (!Object.values(IdentityTypes).includes(type as IdentityTypes)) {
        throw new Error(`invalid identity type`);
      }

      if (!isObjectId(id)) {
        throw new Error(`invalid identity id`);
      }
    });

    return true;
  };

  serializerMap: Field<FieldTypes.IDENTITY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => String(value),
  };
}
