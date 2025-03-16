import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";
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

export class PropertyDate extends Property<PropertyTypes.DATE> {
  serializerMap: Property<PropertyTypes.DATE>["serializerMap"] = {
    json: ({ value }) => {
      const date = toDate(value);

      return date.toJSON();
    },
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => toDate(value),
  };
}
