import { FieldTypes } from "@/enums/field-types.js";
import { FieldSerializerInput, JSONObject, JSONPrimitive, ModelData, ModelInstance } from "@/types/index.js";
import { Field } from "@/lib/field.js";
import { getFieldFromDefinition, getNestedFieldsMap, getValidationValues } from "@/lib/utils.js";

export class FieldObject extends Field<FieldTypes.OBJECT> {
  static symbolIgnore = Symbol("ignore");

  validate: Field<FieldTypes.OBJECT>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => v !== null && v !== undefined && typeof v !== "object";

    const values = getValidationValues(list, this.path);

    return !values.some(_isInvalid);
  };

  _getConditionalKeys = (from: ModelInstance, nextData?: ModelData) => {
    let conditionalKeys: Array<string> | undefined;

    if (this.options.conditionalFields) {
      const { dependsOn, mappings, defaultMapping } = this.options.conditionalFields;
      let dependsOnPath: string = dependsOn;
      if (dependsOnPath.includes("$")) {
        const parentPath = this.path.split(".").slice(0, -1).join(".");
        dependsOnPath = dependsOnPath.replace("$", parentPath).replace(/^\./, "");
      }

      const mapping = from.get(dependsOnPath, "object", { defaults: true }, nextData) as string;
      conditionalKeys = mappings[mapping];
      conditionalKeys ??= mappings[defaultMapping as string];
      conditionalKeys ??= [];
    }

    return conditionalKeys;
  };

  _sStatic = (input: FieldSerializerInput) => {
    const { from, ctx } = input;
    const value = Array.isArray(input.value) ? input.value[0] : input.value;
    const oFormat = ctx?.outputFormat || input.format;

    if (!value || typeof value !== "object") {
      if (oFormat === "validation") {
        return value;
      }

      if (value === undefined) {
        return value;
      }

      return null as any;
    }

    const model = from.model();
    const fieldsMap = getNestedFieldsMap(model, this);
    const defaults = ctx?.defaults ?? true;
    const conditionalKeys = this._getConditionalKeys(from, input.nextData);

    const json: JSONObject = {};

    for (const [k, field] of fieldsMap) {
      if (conditionalKeys && !conditionalKeys.includes(k)) {
        continue;
      }

      if (value[k] === undefined && defaults && "default" in field.options) {
        json[k] = field.serialize({ ...input, value: field.options.default }) as JSONPrimitive;
      } else if (value[k] === undefined || value[k] === null) {
        json[k] = value[k];
      } else {
        json[k] = field.serialize({ ...input, value: value[k] }) as JSONPrimitive;
      }
    }

    if (this.options.strict) {
      return json;
    }

    if (this.options.defaultField) {
      let noField = Object.keys(value).filter(k => !fieldsMap.has(k));

      if (conditionalKeys) {
        noField = noField.filter(k => !conditionalKeys.includes(k));
      }

      if (noField.length) {
        noField.forEach(k => {
          if (value[k] === undefined || value[k] === null) {
            json[k] = value[k];
          } else if (this.options?.defaultField) {
            const tmpField = getFieldFromDefinition(
              this.options.defaultField,
              model.getAdapter(false),
              [this.path, k].join("."),
            );

            json[k] = tmpField?.serialize({ ...input, value: value[k] }) as JSONPrimitive;
          }
        });
      }
    }

    return { ...value, ...json };
  };

  _sProxy = (input: FieldSerializerInput) => {
    const { from, ctx } = input;
    const value = Array.isArray(input.value) ? input.value[0] : input.value;
    const oFormat = ctx?.outputFormat || input.format;

    if (!value || typeof value !== "object") {
      if (oFormat === "validation") {
        return value;
      }

      if (value === undefined) {
        return value;
      }

      return null as any;
    }

    const model = from.model();
    const adapter = model.getAdapter();
    const fieldsMap = getNestedFieldsMap(model, this);
    const conditionalKeys = this._getConditionalKeys(from, input.nextData);

    const _get = (target: any, prop: string) => {
      let targetField = fieldsMap.get(prop);
      let value = target[prop];

      if (!targetField) {
        if (this.options?.strict) {
          return undefined;
        }

        if (!this.options?.defaultField) {
          return value;
        }

        const tmpField = getFieldFromDefinition(this.options.defaultField, adapter, [this.path, prop].join("."));

        if (!tmpField) {
          throw new Error(`Invalid default field ${this.options.defaultField}`);
        }

        targetField = tmpField;
      }

      if (!targetField) {
        return undefined;
      }

      const defaults = ctx?.defaults ?? true;
      if (defaults && value === undefined && "default" in targetField.options) {
        value = targetField.options.default as typeof value;
      }

      if (value === undefined || value === null) {
        return value;
      }

      return targetField.serialize({ ...input, value });
    };

    return new Proxy(value, {
      get(target, prop: string) {
        if (prop === "__isProxy") {
          return true;
        }

        if (prop === "__raw") {
          return (k: string) => {
            if (conditionalKeys && !conditionalKeys.includes(k)) {
              return FieldObject.symbolIgnore;
            }

            return target[k];
          };
        }

        if (conditionalKeys && !conditionalKeys.includes(prop)) {
          return undefined;
        }

        return _get(target, prop);
      },
    });
  };

  serializerMap: Field<FieldTypes.OBJECT>["serializerMap"] = {
    json: this._sStatic,
    [Field.defaultSymbol]: this._sProxy,
  };
}
