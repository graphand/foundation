import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/field.js";

export class FieldInteger extends Field<FieldTypes.INTEGER> {
  serializerMap: Field<FieldTypes.INTEGER>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => parseInt(String(value), 10),
  };
}
