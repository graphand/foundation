import { FieldTypes } from "@/enums/field-types.ts";
import { Field } from "@/lib/Field.ts";
import { Model } from "@/lib/Model.ts";
import { getValidationValues, isObjectId } from "@/lib/utils.ts";
import { PromiseModel } from "@/lib/PromiseModel.ts";
import { FieldSerializerInput } from "@/types/index.ts";
import { CoreError } from "../CoreError.ts";

export class FieldRelation extends Field<FieldTypes.RELATION> {
  validate: Field<FieldTypes.RELATION>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => {
      if (v === null || v === undefined) {
        return false;
      }

      return !isObjectId(v);
    };

    const vs = getValidationValues(list, this.path);

    return !vs.some(_isInvalid);
  };

  _sString = ({ value, format }: FieldSerializerInput) => {
    if (!value) {
      return null;
    }

    let id: string;

    if (typeof value === "object" && "_id" in value) {
      id = String(value._id);
    } else if (value instanceof PromiseModel && typeof value.query === "string") {
      id = value.query;
    } else {
      id = String(value);
    }

    if (!isObjectId(id) && !["validation"].includes(format)) {
      return undefined;
    }

    return id;
  };

  _sObject = (input: FieldSerializerInput) => {
    const id = this._sString(input);

    if (!isObjectId(id)) {
      throw new CoreError({
        message: `Invalid id ${input.value} for relation ${this.path}`,
      });
    }

    const { from, ctx } = input;

    const adapter = from.model().getAdapter();

    // get the referenced model with the same adapter as from parameter
    const model = Model.getClass(this.options.ref, adapter.base);

    return model.get(id as string, Object.assign({}, ctx?.transactionCtx));
  };

  serializerMap: Field<FieldTypes.RELATION>["serializerMap"] = {
    object: this._sObject,
    validation: ({ value }) => value,
    [Field.defaultSymbol]: this._sString,
  };
}
