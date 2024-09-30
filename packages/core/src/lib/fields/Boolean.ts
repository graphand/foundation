import { FieldTypes } from "@/enums/field-types.ts";
import { Field } from "@/lib/Field.ts";

export class FieldBoolean extends Field<FieldTypes.BOOLEAN> {
  serializerMap: Field<FieldTypes.BOOLEAN>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => Boolean(value),
  };
}
