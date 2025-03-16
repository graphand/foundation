import { PropertyTypes } from "@/enums/property-types.js";
import { PropertySerializerInput } from "@/index.js";
import { Property } from "@/lib/property.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class PropertyText extends Property<PropertyTypes.TEXT> {
  validate: Property<PropertyTypes.TEXT>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (isObjectId(v)) {
        throw new Error(`value is an ObjectId. Text properties do not accept ObjectId values`);
      }
    });

    return true;
  };

  _sDefault = ({ value }: PropertySerializerInput) => {
    const single = Array.isArray(value) ? String(value[0]) : String(value);

    return single;
  };

  serializerMap: Property<PropertyTypes.TEXT>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this._sDefault,
  };
}
