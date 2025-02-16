import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/field.js";
import { CoreError } from "../core-error.js";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  throw new CoreError({
    message: `Error serializing date with value ${value}`,
  });
};

export class FieldDate extends Field<FieldTypes.DATE> {
  serializerMap: Field<FieldTypes.DATE>["serializerMap"] = {
    json: ({ value }) => {
      const date = toDate(value);

      return date.toJSON();
    },
    validation: ({ value }) => value,
    [Field.defaultSymbol]: ({ value }) => toDate(value),
  };
}
