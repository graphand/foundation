import { PropertyTypes } from "@/enums/property-types.js";
import { PropertySerializerInput } from "@/index.js";
import { Property } from "@/lib/property.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class PropertyEnum extends Property<PropertyTypes.ENUM> {
  validate: Property<PropertyTypes.ENUM>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);
    const enums = this.definition.enum ?? [];

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (!enums.includes(String(v))) {
        throw new Error(`value does not match enum`);
      }

      if (isObjectId(v)) {
        throw new Error(`value is an ObjectId. Enum properties do not accept ObjectId values`);
      }
    });

    return true;
  };

  _sDefault = ({ value }: PropertySerializerInput) => {
    const single = Array.isArray(value) ? String(value[0]) : String(value);
    const enums = this.definition.enum ?? [];

    return enums.includes(single) ? single : undefined;
  };

  serializerMap: Property<PropertyTypes.ENUM>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this._sDefault,
  };
}
