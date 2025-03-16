import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";

export class PropertyNumber extends Property<PropertyTypes.NUMBER> {
  serializerMap: Property<PropertyTypes.NUMBER>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => Number(value),
  };
}
