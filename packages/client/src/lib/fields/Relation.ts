import {
  FieldTypes,
  FieldRelation as CoreFieldRelation,
  Field,
  FieldSerializerInput,
  PromiseModel,
  Model,
} from "@graphand/core";
import { getCachedModel } from "../utils.ts";

class FieldRelation extends CoreFieldRelation {
  decodePopulate = (fn: any) => {
    return (input: FieldSerializerInput) => {
      let res;
      if (input.ctx?.hasNext) {
        const promise = this._sObject(input) as PromiseModel<typeof Model>;
        res = promise ? getCachedModel(promise) : undefined;
      }

      return res ?? fn(input);
    };
  };

  serializerMap: Field<FieldTypes.RELATION>["serializerMap"] = {
    object: this.decodePopulate(this._sObject),
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this.decodePopulate(this._sString),
  };
}

export default FieldRelation;
