import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/Field.js";

export class FieldBoolean extends Field<FieldTypes.BOOLEAN> {
  serializerMap: Field<FieldTypes.BOOLEAN>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => Boolean(value),
  };
}
