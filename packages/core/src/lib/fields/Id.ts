import { FieldTypes } from "@/enums/field-types";
import { Field } from "@/lib/Field";

export class FieldId extends Field<FieldTypes.ID> {
  serializerMap: Field<FieldTypes.ID>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => String(value),
  };
}
