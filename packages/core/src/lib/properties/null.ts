import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";
import { getValidationValues } from "../utils.js";

export class PropertyNull extends Property<PropertyTypes.NULL> {
  validate: Property<PropertyTypes.NULL>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === undefined) {
        return;
      }

      if (v !== null) {
        throw new Error(`value is not null. null properties do not accept non-null values`);
      }
    });

    return true;
  };

  serializerMap: Property<PropertyTypes.NULL>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: () => null,
  };
}
