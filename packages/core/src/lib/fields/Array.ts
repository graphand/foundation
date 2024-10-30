import { FieldTypes } from "@/enums/field-types.js";
import { FieldOptions, FieldSerializerInput } from "@/types/index.js";
import { Field } from "@/lib/Field.js";
import { Model } from "@/lib/Model.js";
import { getFieldFromDefinition, getValidationValues, isObjectId } from "@/lib/utils.js";
import { CoreError } from "@/lib/CoreError.js";
import { PromiseModelList } from "@/lib/PromiseModelList.js";
import { ModelList } from "@/lib/ModelList.js";

export class FieldArray extends Field<FieldTypes.ARRAY> {
  validate: Field<FieldTypes.ARRAY>["validate"] = async ({ list }) => {
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

  _sToRelArr = (input: FieldSerializerInput) => {
    const options = this.options.items?.options as FieldOptions<FieldTypes.RELATION>;
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

      if (model.isSingle()) {
        res = arrVal.map((v, i) => {
          const itemsField = getFieldFromDefinition(this.options.items, adapter, this.path + `.[${i}]`);

          return itemsField?.serialize({ ...input, value: v });
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

    const fieldId = getFieldFromDefinition<FieldTypes.ID>({ type: FieldTypes.ID }, adapter, "_id");

    return arrVal.map(id => fieldId?.serialize({ ...input, value: id }));
  };

  _sStatic = (input: FieldSerializerInput) => {
    const { value, from } = input;
    const adapter = from.model().getAdapter();
    const arrVal = Array.isArray(value) ? value : [value];

    return arrVal.map((v, i) => {
      const itemsField = getFieldFromDefinition(this.options.items, adapter, this.path + `.[${i}]`);

      return itemsField?.serialize({ ...input, value: v });
    });
  };

  _sDefault = (input: FieldSerializerInput) => {
    if (this.options.items?.type === FieldTypes.RELATION) {
      return this._sToRelArr(input);
    }

    return this._sStatic(input);
  };

  serializerMap: Field<FieldTypes.ARRAY>["serializerMap"] = {
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this._sDefault,
  };
}
