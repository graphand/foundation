import { FieldTypes } from "@/enums/field-types.ts";
import { Field } from "@/lib/Field.ts";

export class FieldNumber extends Field<FieldTypes.NUMBER> {
  serializerMap: Field<FieldTypes.NUMBER>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => Number(value),
  };
}
