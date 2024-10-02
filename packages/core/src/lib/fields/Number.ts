import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/Field.js";

export class FieldNumber extends Field<FieldTypes.NUMBER> {
  serializerMap: Field<FieldTypes.NUMBER>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => Number(value),
  };
}
