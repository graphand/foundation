import { FieldTypes } from "@/enums/field-types.js";
import { FieldSerializerInput, JSONTypeObject } from "@/types/index.js";
import { Field } from "@/lib/Field.js";
import { getFieldFromDefinition, getNestedFieldsMap, getValidationValues } from "@/lib/utils.js";

export class FieldNested extends Field<FieldTypes.NESTED> {
  static symbolIgnore = Symbol("ignore");

  validate: Field<FieldTypes.NESTED>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => v !== null && v !== undefined && typeof v !== "object";

    const values = getValidationValues(list, this.path);

    return !values.some(_isInvalid);
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
    let filterKey: string | undefined;

    if (this.options.dependsOn) {
      let dependsOnPath: string = this.options.dependsOn;
      if (dependsOnPath.includes("$")) {
        const parentPath = this.path.split(".").slice(0, -1).join(".");
        dependsOnPath = dependsOnPath.replace("$", parentPath).replace(/^\./, "");
      }

      const dependsOn = from.get(dependsOnPath);
      if (dependsOn) {
        filterKey = dependsOn as string;
      }
    }

    const json: JSONTypeObject = {};

    for (const [k, field] of fieldsMap) {
      if (filterKey && k !== filterKey) {
        continue;
      }

      if (value[k] === undefined && defaults && "default" in field.options) {
        json[k] = field.serialize(field.options.default, input.format, from, ctx);
      } else if (value[k] === undefined || value[k] === null) {
        json[k] = value[k];
      } else {
        json[k] = field.serialize(value[k], input.format, from, ctx);
      }
    }

    if (this.options.strict) {
      return json;
    }

    if (this.options.defaultField) {
      let noField = Object.keys(value).filter(k => !fieldsMap.has(k));

      if (filterKey) {
        noField = noField.filter(k => k !== filterKey);
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

            json[k] = tmpField?.serialize(value[k], input.format, from, ctx);
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
    let filterKey: string;

    if (this.options.dependsOn) {
      let dependsOnPath: string = this.options.dependsOn;
      if (dependsOnPath.includes("$")) {
        const parentPath = this.path.split(".").slice(0, -1).join(".");
        dependsOnPath = dependsOnPath.replace("$", parentPath).replace(/^\./, "");
      }

      const dependsOn = from.get(dependsOnPath);
      if (dependsOn) {
        filterKey = dependsOn as string;
      }
    }

    const _getter = (target: any, prop: string) => {
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

      return targetField.serialize(value, input.format, from, ctx);
    };

    return new Proxy(value, {
      get(target, prop: string) {
        if (prop === "__isProxy") {
          return true;
        }

        if (prop === "__raw") {
          return (k: string) => {
            if (filterKey && k !== filterKey) {
              return FieldNested.symbolIgnore;
            }

            return target[k];
          };
        }

        if (filterKey && prop !== filterKey) {
          return undefined;
        }

        return _getter(target, prop);
      },
    });
  };

  serializerMap: Field<FieldTypes.NESTED>["serializerMap"] = {
    json: this._sStatic,
    [Field.defaultSymbol]: this._sProxy,
  };
}
