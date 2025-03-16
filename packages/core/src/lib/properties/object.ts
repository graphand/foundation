import { PropertyTypes } from "@/enums/property-types.js";
import { PropertySerializerInput, JSONObject, JSONPrimitive, ModelData, ModelInstance } from "@/types/index.js";
import { Property } from "@/lib/property.js";
import { getPropertyFromDefinition, getNestedPropertiesMap, getValidationValues } from "@/lib/utils.js";

export class PropertyObject extends Property<PropertyTypes.OBJECT> {
  static symbolIgnore = Symbol("ignore");

  validate: Property<PropertyTypes.OBJECT>["validate"] = async ({ list }) => {
    const _isInvalid = (v: unknown) => v !== null && v !== undefined && typeof v !== "object";

    const values = getValidationValues(list, this.path);

    return !values.some(_isInvalid);
  };

  _getConditionalKeys = (from: ModelInstance, nextData?: ModelData) => {
    let conditionalKeys: Array<string> | undefined;

    if (this.options.conditionalProperties) {
      const { dependsOn, mappings, defaultMapping } = this.options.conditionalProperties;
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

  _sStatic = (input: PropertySerializerInput) => {
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
    const propertiesMap = getNestedPropertiesMap(model, this);
    const defaults = ctx?.defaults ?? true;
    const conditionalKeys = this._getConditionalKeys(from, input.nextData);

    const json: JSONObject = {};

    for (const [k, property] of propertiesMap) {
      if (conditionalKeys && !conditionalKeys.includes(k)) {
        continue;
      }

      if (value[k] === undefined && defaults && "default" in property.options) {
        json[k] = property.serialize({ ...input, value: property.options.default }) as JSONPrimitive;
      } else if (value[k] === undefined || value[k] === null) {
        json[k] = value[k];
      } else {
        json[k] = property.serialize({ ...input, value: value[k] }) as JSONPrimitive;
      }
    }

    if (this.options.strict) {
      return json;
    }

    if (this.options.defaultProperty) {
      let noProperty = Object.keys(value).filter(k => !propertiesMap.has(k));

      if (conditionalKeys) {
        noProperty = noProperty.filter(k => !conditionalKeys.includes(k));
      }

      if (noProperty.length) {
        noProperty.forEach(k => {
          if (value[k] === undefined || value[k] === null) {
            json[k] = value[k];
          } else if (this.options?.defaultProperty) {
            const tmpProperty = getPropertyFromDefinition(
              this.options.defaultProperty,
              model.getAdapter(false),
              [this.path, k].join("."),
            );

            json[k] = tmpProperty?.serialize({ ...input, value: value[k] }) as JSONPrimitive;
          }
        });
      }
    }

    return { ...value, ...json };
  };

  _sProxy = (input: PropertySerializerInput) => {
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
    const propertiesMap = getNestedPropertiesMap(model, this);
    const conditionalKeys = this._getConditionalKeys(from, input.nextData);

    const _get = (target: any, prop: string) => {
      let targetProperty = propertiesMap.get(prop);
      let value = target[prop];

      if (!targetProperty) {
        if (this.options?.strict) {
          return undefined;
        }

        if (!this.options?.defaultProperty) {
          return value;
        }

        const tmpProperty = getPropertyFromDefinition(
          this.options.defaultProperty,
          adapter,
          [this.path, prop].join("."),
        );

        if (!tmpProperty) {
          throw new Error(`Invalid default property ${this.options.defaultProperty}`);
        }

        targetProperty = tmpProperty;
      }

      if (!targetProperty) {
        return undefined;
      }

      const defaults = ctx?.defaults ?? true;
      if (defaults && value === undefined && "default" in targetProperty.options) {
        value = targetProperty.options.default as typeof value;
      }

      if (value === undefined || value === null) {
        return value;
      }

      return targetProperty.serialize({ ...input, value });
    };

    return new Proxy(value, {
      get(target, prop: string) {
        if (prop === "__isProxy") {
          return true;
        }

        if (prop === "__raw") {
          return (k: string) => {
            if (conditionalKeys && !conditionalKeys.includes(k)) {
              return PropertyObject.symbolIgnore;
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

  serializerMap: Property<PropertyTypes.OBJECT>["serializerMap"] = {
    json: this._sStatic,
    data: this._sStatic,
    [Property.defaultSymbol]: this._sProxy,
  };
}
