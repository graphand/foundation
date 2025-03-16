import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";

export class PropertyInteger extends Property<PropertyTypes.INTEGER> {
  serializerMap: Property<PropertyTypes.INTEGER>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => parseInt(String(value), 10),
  };
}
