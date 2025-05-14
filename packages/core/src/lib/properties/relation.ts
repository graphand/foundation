import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";
import { Model } from "@/lib/model.js";
import { getValidationValues, isObjectId } from "@/lib/utils.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { PropertySerializerInput } from "@/types/index.js";
import { CoreError } from "../core-error.js";

export class PropertyRelation extends Property<PropertyTypes.RELATION> {
  validate: Property<PropertyTypes.RELATION>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (!isObjectId(v)) {
        throw new Error(`value is not an ObjectId`);
      }
    });

    return true;
  };

  _sString = ({ value }: PropertySerializerInput) => {
    let id: string;

    if (typeof value === "object" && value && "_id" in value) {
      id = String(value._id);
    } else if (value instanceof PromiseModel && typeof value.query === "string") {
      id = value.query;
    } else {
      id = String(value);
    }

    return id;
  };

  _sObject = (input: PropertySerializerInput) => {
    const id = this._sString(input);

    if (!isObjectId(id)) {
      throw new CoreError({
        message: `Invalid id ${input.value} for relation ${this.path}`,
      });
    }

    const { from, ctx } = input;

    const adapter = from.model().getAdapter();

    if (!this.definition.ref) {
      throw new CoreError({
        message: `Relation ${this.path} has no ref`,
      });
    }

    // get the referenced model with the same adapter as from parameter
    const model = Model.getClass(this.definition.ref, adapter.base);

    return model.get(id as string, Object.assign({}, ctx?.transactionCtx));
  };

  serializerMap: Property<PropertyTypes.RELATION>["serializerMap"] = {
    object: this._sObject,
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this._sString,
  };
}
