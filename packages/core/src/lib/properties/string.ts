import { PropertyTypes } from "@/enums/property-types.js";
import { PropertySerializerInput } from "@/index.js";
import { Property } from "@/lib/property.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class PropertyString extends Property<PropertyTypes.STRING> {
  validate: Property<PropertyTypes.STRING>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);
    const enums = this.definition.enum;

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (enums && !enums.includes(String(v))) {
        throw new Error(`value does not match enum`);
      }

      if (isObjectId(v)) {
        throw new Error(
          `value is an ObjectId. string properties do not accept ObjectId values. Use a relation field instead.`,
        );
      }
    });

    return true;
  };

  _sDefault = ({ value }: PropertySerializerInput) => {
    const single = Array.isArray(value) ? String(value[0]) : String(value);
    const enums = this.definition.enum;

    if (enums && !enums.includes(single)) {
      return undefined;
    }

    return single;
  };

  serializerMap: Property<PropertyTypes.STRING>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this._sDefault,
  };
}
