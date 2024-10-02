import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/Field.js";

const toDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

export class FieldDate extends Field<FieldTypes.DATE> {
  serializerMap: Field<FieldTypes.DATE>["serializerMap"] = {
    json: ({ value }) => {
      const date = toDate(value);
      return date ? date.toJSON() : null;
    },
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => toDate(value),
  };
}
