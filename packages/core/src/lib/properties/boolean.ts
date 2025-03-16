import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";

export class PropertyBoolean extends Property<PropertyTypes.BOOLEAN> {
  serializerMap: Property<PropertyTypes.BOOLEAN>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => Boolean(value),
  };
}
