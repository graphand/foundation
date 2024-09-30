import { FieldTypes } from "@/enums/field-types.ts";
import { Field } from "@/lib/Field.ts";

export class FieldId extends Field<FieldTypes.ID> {
  serializerMap: Field<FieldTypes.ID>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => String(value),
  };
}
