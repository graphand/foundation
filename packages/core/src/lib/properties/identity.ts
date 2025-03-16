import { PropertyTypes } from "@/enums/property-types.js";
import { IdentityTypes } from "@/enums/identity-types.js";
import { Property } from "@/lib/property.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";

export class PropertyIdentity extends Property<PropertyTypes.IDENTITY> {
  validate: Property<PropertyTypes.IDENTITY>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      const [type, id] = String(v).split(":");

      if (!Object.values(IdentityTypes).includes(type as IdentityTypes)) {
        throw new Error(`invalid identity type`);
      }

      if (!isObjectId(id)) {
        throw new Error(`invalid identity id`);
      }
    });

    return true;
  };

  serializerMap: Property<PropertyTypes.IDENTITY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: ({ value }) => String(value),
  };
}
