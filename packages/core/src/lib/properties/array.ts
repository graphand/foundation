import { PropertyTypes } from "@/enums/property-types.js";
import { PropertyOptions, PropertySerializerInput } from "@/types/index.js";
import { Property } from "@/lib/property.js";
import { Model } from "@/lib/model.js";
import { getPropertyFromDefinition, getValidationValues, isObjectId } from "@/lib/utils.js";
import { CoreError } from "@/lib/core-error.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import { ModelList } from "@/lib/model-list.js";

export class PropertyArray extends Property<PropertyTypes.ARRAY> {
  validate: Property<PropertyTypes.ARRAY>["validate"] = async ({ list }) => {
    const values = getValidationValues(list, this.path);

    values.forEach(v => {
      if (v === null || v === undefined) {
        return;
      }

      if (!Array.isArray(v)) {
        throw new Error(`value is not an array`);
      }

      if (this.options.distinct) {
        const vSet = new Set();
        if (
          v.some(v => {
            if (v && (Array.isArray(v) || typeof v === "object")) {
              v = JSON.stringify(v);
            }

            if (vSet.has(v)) {
              return true;
            }

            vSet.add(v);
            return false;
          })
        ) {
          throw new Error(`array contains duplicate values`);
        }
      }
    });

    return true;
  };

  _sToRelArr = (input: PropertySerializerInput) => {
    const options = this.options.items?.options as PropertyOptions<PropertyTypes.RELATION>;
    const { value, format, from, ctx } = input;

    const adapter = from.model().getAdapter();
    let arrVal;

    if (value instanceof PromiseModelList) {
      arrVal = value.getIds();
    } else if (value instanceof ModelList) {
      arrVal = value.getIds();
    } else {
      arrVal = Array.isArray(value) ? value : [value];
    }

    if (format === "object") {
      const model = Model.getClass(options.ref, adapter.base);

      if (!arrVal?.every(isObjectId)) {
        throw new CoreError({
          message: `Error serializing array of relations with ids ${value}`,
        });
      }

      let res;

      if (model.configuration.single) {
        res = arrVal.map((v, i) => {
          const itemsProperty = getPropertyFromDefinition(this.options.items, adapter, this.path + `.[${i}]`);

          return itemsProperty?.serialize({ ...input, value: v });
        });
      } else {
        const ids = arrVal.map(String);
        res = model.getList({ ids }, Object.assign({}, ctx?.transactionCtx));
      }

      return res;
    } else if (value instanceof PromiseModelList || value instanceof ModelList) {
      arrVal = value.getIds();
    }

    if (!value) {
      return [];
    }

    const propertyId = getPropertyFromDefinition<PropertyTypes.ID>({ type: PropertyTypes.ID }, adapter, "_id");

    return arrVal.map(id => propertyId?.serialize({ ...input, value: id }));
  };

  _sStatic = (input: PropertySerializerInput) => {
    const { value, from } = input;
    const adapter = from.model().getAdapter();
    const arrVal = Array.isArray(value) ? value : [value];

    return arrVal.map((v, i) => {
      const itemsProperty = getPropertyFromDefinition(this.options.items, adapter, this.path + `.[${i}]`);

      return itemsProperty?.serialize({ ...input, value: v });
    });
  };

  _sDefault = (input: PropertySerializerInput) => {
    if (this.options.items?.type === PropertyTypes.RELATION) {
      return this._sToRelArr(input);
    }

    return this._sStatic(input);
  };

  serializerMap: Property<PropertyTypes.ARRAY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Property.defaultSymbol]: this._sDefault,
  };
}
