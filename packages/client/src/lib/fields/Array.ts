import {
  FieldTypes,
  FieldArray as CoreFieldArray,
  Field,
  FieldSerializerInput,
  PromiseModelList,
  Model,
} from "@graphand/core";
import { getCachedModelList } from "../utils.js";

class FieldArray extends CoreFieldArray {
  decodePopulate = (fn: any) => {
    return (input: FieldSerializerInput) => {
      let res;
      if (input.ctx?.hasNext) {
        const promise = this._sDefault({ ...input, format: "object" }) as PromiseModelList<typeof Model>;
        res = promise ? getCachedModelList(promise)?.toArray() : undefined;
      }

      return res ?? fn(input);
    };
  };

  serializerMap: Field<FieldTypes.RELATION>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this.decodePopulate(this._sDefault),
  };
}

export default FieldArray;
