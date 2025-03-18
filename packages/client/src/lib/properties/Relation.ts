import {
  PropertyTypes,
  PropertyRelation as CorePropertyRelation,
  Property,
  PropertySerializerInput,
  PromiseModel,
  Model,
} from "@graphand/core";
import { getCachedModel } from "../utils.js";

class PropertyRelation extends CorePropertyRelation {
  decodePopulate = (fn: any) => {
    return (input: PropertySerializerInput) => {
      let res;
      if (input.ctx?.hasNext) {
        const promise = this._sObject(input) as PromiseModel<typeof Model>;
        res = promise ? getCachedModel(promise) : undefined;
      }

      return res ?? fn(input);
    };
  };

  serializerMap: Property<PropertyTypes.RELATION>["serializerMap"] = {
    object: this.decodePopulate(this._sObject),
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this.decodePopulate(this._sString),
  };
}

export default PropertyRelation;
