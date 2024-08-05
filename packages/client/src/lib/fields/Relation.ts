import {
  FieldTypes,
  FieldRelation as CoreFieldRelation,
  Field,
  FieldSerializerInput,
  PromiseModel,
  Model,
  PromiseModelList,
} from "@graphand/core";

class FieldRelation extends CoreFieldRelation {
  decodePopulate = (fn: any) => {
    return (input: FieldSerializerInput) => {
      let res;
      if (input.ctx?.hasNext) {
        const promise = this._sObject(input) as PromiseModel<typeof Model> | PromiseModelList<typeof Model>;
        res = promise?.cached;
      }

      return res ?? fn(input);
    };
  };

  serializerMap: Field<FieldTypes.RELATION>["serializerMap"] = {
    object: this._sObject,
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this.decodePopulate(this._sString),
  };
}

export default FieldRelation;
