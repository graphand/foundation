import {
  PropertyTypes,
  PropertyArray as CorePropertyArray,
  Property,
  PropertySerializerInput,
  PromiseModelList,
  Model,
} from "@graphand/core";
import { getCachedModelList } from "../utils.js";

class PropertyArray extends CorePropertyArray {
  decodePopulate = (fn: any) => {
    return (input: PropertySerializerInput) => {
      let res;
      if (input.ctx?.hasNext) {
        const promise = this._sDefault({ ...input, format: "object" }) as PromiseModelList<typeof Model>;
        res = promise ? getCachedModelList(promise)?.toArray() : undefined;
      }

      return res ?? fn(input);
    };
  };

  serializerMap: Property<PropertyTypes.ARRAY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this.decodePopulate(this._sDefault),
  };
}

export default PropertyArray;
