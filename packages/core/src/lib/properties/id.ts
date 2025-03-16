import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";

export class PropertyId extends Property<PropertyTypes.ID> {
  serializerMap: Property<PropertyTypes.ID>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => String(value),
  };
}
