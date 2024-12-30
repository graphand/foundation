import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/field.js";

export class FieldId extends Field<FieldTypes.ID> {
  serializerMap: Field<FieldTypes.ID>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => String(value),
  };
}
