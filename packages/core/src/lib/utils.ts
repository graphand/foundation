import { Model } from "@/lib/model.js";
import {
  AdapterFetcher,
  PropertyDefinitionGeneric,
  PropertyOptionsMap,
  PropertiesPathItem,
  Hook,
  HookPhase,
  ModelInstance,
  ValidatorDefinitionGeneric,
  ValidatorOptions,
  PropertyOptions,
  SerializerFormat,
  SerializerCtx,
  TransactionCtx,
  PropertiesDefinition,
  Transaction,
  ModelJSON,
  ModelData,
  ValidatorDefinition,
  PropertyDefinition,
  ValidatorsDefinition,
} from "@/types/index.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { Adapter } from "@/lib/adapter.js";
import { ValidationValidatorError } from "@/lib/validation-validator-error.js";
import { ValidationPropertyError } from "@/lib/validation-property-error.js";
import { ValidationError } from "@/lib/validation-error.js";
import type { DataModel } from "@/models/data-model.js";
import { Patterns } from "@/enums/patterns.js";
import { PropertyObject } from "./properties/object.js";

export const crossModelTree = (_model: typeof Model, cb: (_model: typeof Model) => void) => {
  let model = _model;

  do {
    cb(model);

    model = Object.getPrototypeOf(model);
  } while (model && model !== Model);

  cb(Model);
};

/**
 * The function `getRelationModelsFromPath` takes a model and a path as input and returns an array of relation models found in
 * the path.
 * @param model - The `model` parameter is the type of the model for which you want to retrieve the relation models in the path.
 * @param { Array<string> | string } pathArr - The `pathArr` parameter is either an array of strings or a
 * string. It represents the path to a specific property in the model.
 * @returns { Promise<Array<typeof Model>> } The function `getRelationModelsFromPath` returns an array of `typeof Model` objects
 * representing the relation models found in the path.
 */
export const getRelationModelsFromPath = async (
  model: typeof Model,
  pathArr: Array<string> | string,
): Promise<Array<typeof Model>> => {
  await model.initialize();
  pathArr = Array.isArray(pathArr) ? pathArr : pathArr.split(".");
  const properties = getPropertiesPathsFromPath(model, pathArr);
  const relationModels: Set<string> = new Set();

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];

    if (!property) {
      break;
    }

    const isLast = i === properties.length - 1;
    if (property.property.type === PropertyTypes.RELATION) {
      const options = property.property.options as PropertyOptions<PropertyTypes.RELATION>;
      const refModel = Model.getClass(options.ref, model.getAdapter(false).base);
      relationModels.add(refModel.configuration.slug);

      if (!isLast) {
        await refModel.initialize();
        const rest = pathArr.slice(i + 1);
        const models = await getRelationModelsFromPath(refModel, rest);
        models.forEach(m => relationModels.add(m.configuration.slug));
      }
    }
  }

  return Array.from(relationModels).map(slug => Model.getClass(slug, model.getAdapter(false).base));
};

/**
 * The function `getPropertiesPathsFromPath` takes a model and a path array or string as input and returns
 * an array of the decomposed properties path.
 * @param model - The `model` parameter is the type of the model that contains the properties. It is of
 * type `typeof Model`.
 * @param {Array<string> | string} pathArr - The `pathArr` parameter is either an array of strings or a
 * string. It represents the path to a specific property in the model.
 * @returns The function `getPropertiesPathsFromPath` returns an array of `PropertiesPathItem` objects.
 */
export const getPropertiesPathsFromPath = (
  model: typeof Model,
  pathArr: Array<string> | string,
): Array<PropertiesPathItem | null> => {
  const paths = Array.isArray(pathArr) ? pathArr : pathArr.split(".");
  const firstPropertyKey = paths[0];
  if (!firstPropertyKey) {
    return [];
  }

  const firstProperty = model.propertiesMap?.get(firstPropertyKey);
  const adapter = model.getAdapter(false);

  const result: Array<PropertiesPathItem | null> = firstProperty
    ? [{ key: firstPropertyKey, property: firstProperty }]
    : [null];

  if (paths.length === 1) {
    return result;
  }

  for (let i = 1; i < paths.length; i++) {
    const key = paths[i] as string;
    const prevProperty = result[result.length - 1]?.property;
    const pathStr = result.map(item => item?.key).join(".");

    if (prevProperty?.type === PropertyTypes.ARRAY) {
      const options = prevProperty.options as PropertyOptions<PropertyTypes.ARRAY>;
      const matchIndex = key.match(/\[(\d+)?\]/);

      if (matchIndex) {
        const index = matchIndex[1] ? parseInt(matchIndex[1], 10) : null;
        if (index !== null) {
          const itemsProperty = getPropertyFromDefinition(options.items, adapter, `${pathStr}.[${index}]`);
          if (itemsProperty) {
            result.push({ key: `[${index}]`, property: itemsProperty });
          } else {
            result.push(null);
          }
          continue;
        }
      }

      const itemsProperty = getPropertyFromDefinition(options.items, adapter, `${pathStr}.[]`);
      if (itemsProperty) {
        result.push({ key: "[]", property: itemsProperty });
      } else {
        result.push(null);
      }

      if (matchIndex) continue;

      if (itemsProperty?.type === PropertyTypes.OBJECT) {
        const nestedOptions = itemsProperty.options as PropertyOptions<PropertyTypes.OBJECT>;
        const nextPropertyDef = nestedOptions?.properties?.[key];
        if (!nextPropertyDef) {
          result.push(null);
          continue;
        }

        const nextProperty = getPropertyFromDefinition(nextPropertyDef, adapter, `${pathStr}.[].${key}`);
        if (nextProperty) {
          result.push({ key, property: nextProperty });
          continue;
        }
      }
    }

    if (prevProperty?.type === PropertyTypes.OBJECT) {
      const options = prevProperty.options as PropertyOptions<PropertyTypes.OBJECT>;
      let nextPropertyDef = options.properties?.[key] || options.additionalProperties;
      if (nextPropertyDef === undefined && !options.strict) {
        nextPropertyDef = {
          type: PropertyTypes.DEFAULT,
        };
      }

      if (!nextPropertyDef) {
        result.push(null);
        continue;
      }

      const nextProperty = getPropertyFromDefinition(nextPropertyDef, adapter, `${pathStr}.${key}`);
      if (nextProperty) {
        result.push({ key, property: nextProperty });
        continue;
      }
    }

    if (prevProperty?.type === PropertyTypes.DEFAULT) {
      const nextProperty = getPropertyFromDefinition(
        {
          type: PropertyTypes.DEFAULT,
        },
        adapter,
        `${pathStr}.${key}`,
      );

      if (nextProperty) {
        result.push({ key, property: nextProperty });
        continue;
      }
    }

    if (prevProperty?.type === PropertyTypes.RELATION) {
      const options = prevProperty.options as PropertyOptions<PropertyTypes.RELATION>;
      const refModel = Model.getClass(options.ref, adapter.base);
      const restPaths = paths.slice(i);
      const nextProperties = getPropertiesPathsFromPath(refModel, restPaths);
      result.push(...nextProperties);
      break;
    }

    result.push(null);
  }

  return result;
};

/**
 * The function `getRecursiveHooksFromModel` retrieves all recursive hooks from a model based on the
 * provided action and phase.
 * @param {T} model - The `model` parameter is the model class from which you want to retrieve the
 * recursive hooks. It should be a subclass of the `Model` class.
 * @param {A} action - The `action` parameter represents the specific action that the hooks are
 * associated with. It is a key of the `AdapterFetcher` interface.
 * @param {HookPhase} phase - The `phase` parameter represents the phase of the hook. It is of type
 * `HookPhase`.
 * @returns an array of hooks.
 */
export const getRecursiveHooksFromModel = <A extends keyof AdapterFetcher, T extends typeof Model, P extends HookPhase>(
  model: T,
  action: A,
  phase: P,
): Array<Hook<P, A, T>> => {
  const adapter = model.getAdapter(false);
  const _hooks: Array<Hook<P, A, T>> = [];

  crossModelTree(model, m => {
    if (m.hasOwnProperty("__hooks")) {
      const _modelHooks = Array.from(m.__hooks || []).filter(h => {
        if (h.action !== action) {
          return false;
        }

        if (h.phase !== phase) {
          return false;
        }

        if (h.adapterClass) {
          if (Array.isArray(h.adapterClass)) {
            if (!h.adapterClass.some(a => adapter instanceof a)) {
              return false;
            }
          } else {
            if (!(adapter instanceof h.adapterClass)) {
              return false;
            }
          }
        }

        return true;
      });

      if (_modelHooks?.length) {
        Array.prototype.push.apply(_hooks, _modelHooks);
      }
    }
  });

  return _hooks.sort((a, b) => a.order - b.order);
};

/**
 * The function `getNestedPropertiesMap` takes a model and a nested property as input, and returns a map of
 * the nested properties within the given property.
 * @param model - The `model` parameter is the type of the model that contains the nested property. It is
 * of type `typeof Model`.
 * @param nestedProperty - The `nestedProperty` parameter is of type `Property<PropertyTypes.OBJECT>`. It
 * represents a nested property in a model.
 * @returns The function `getNestedPropertiesMap` returns a `Map` object.
 */
export const getNestedPropertiesMap = (model: typeof Model, nestedProperty: Property<PropertyTypes.OBJECT>) => {
  const adapter = model.getAdapter(false);
  const map = new Map<string, Property>();

  Object.entries(nestedProperty.options.properties ?? {}).forEach(([slug, def]) => {
    const property = getPropertyFromDefinition(def, adapter, nestedProperty.path + "." + slug);

    if (property) {
      map.set(slug, property);
    }
  });

  return map;
};

/**
 * The function `getNestedValidatorsArray` returns an array of validators for a nested property in a
 * model.
 * @param model - The `model` parameter is the type of the model that contains the nested property. It is
 * of type `typeof Model`.
 * @param nestedProperty - The `nestedProperty` parameter is of type `Property<PropertyTypes.OBJECT>`. It
 * represents a nested property in a model.
 * @returns an array of validators.
 */
export const getNestedValidatorsArray = (model: typeof Model, nestedProperty: Property<PropertyTypes.OBJECT>) => {
  const adapter = model.getAdapter(false);
  const validators: Array<Validator> = [];

  nestedProperty.options.validators?.forEach(def => {
    const validator = getValidatorFromDefinition(def, adapter, nestedProperty.path);

    if (validator) {
      validators.push(validator);
    }
  });

  return validators;
};

/**
 * The function `getArrayItemsPropertiesMap` takes a model and an array property as input, and returns a map
 * of the properties within the array.
 * @param model - The `model` parameter is the model class that represents a database table or
 * collection. It is of type `typeof Model`.
 * @param arrayProperty - The `arrayProperty` parameter is a property of type `PropertyTypes.ARRAY`. It represents
 * an array property in a model.
 * @returns a Map object.
 */
export const getArrayItemsPropertiesMap = (model: typeof Model, arrayProperty: Property<PropertyTypes.ARRAY>) => {
  const adapter = model.getAdapter();
  const map = new Map();

  const itemsProperty = getPropertyFromDefinition(arrayProperty.options.items, adapter, arrayProperty.path + ".[]");

  if (itemsProperty) {
    map.set("[]", itemsProperty);
  }

  return map;
};

/**
 * The function `getArrayValidatorsArray` returns an array of validators for a given array property in a
 * model.
 * @param model - The `model` parameter is the type of the model that contains the array property. It is
 * of type `typeof Model`.
 * @param arrayProperty - The `arrayProperty` parameter is of type `Property<PropertyTypes.ARRAY>`. It represents a
 * property in a model that is of type array.
 * @returns an array of validators.
 */
export const getArrayValidatorsArray = (model: typeof Model, arrayProperty: Property<PropertyTypes.ARRAY>) => {
  const adapter = model.getAdapter();
  const validators: Array<Validator> = [];

  arrayProperty.options.validators?.forEach(def => {
    const validator = getValidatorFromDefinition(def as ValidatorDefinition, adapter, arrayProperty.path + ".[]");

    if (validator) {
      validators.push(validator);
    }
  });

  return validators;
};

/**
 * The `createPropertiesMap` function creates a map of properties from a model/
 * @param model - The `model` parameter is the type of the model for which you want to create a properties
 * map. It is of type `typeof Model`.
 * @returns The function `createPropertiesMap` returns a `Map` object.
 */
export const createPropertiesMap = (model: typeof Model): Map<string, Property> => {
  const properties: PropertiesDefinition = Object.assign({}, model.configuration.properties);

  if (model.systemProperties) {
    Object.assign(properties, model.systemProperties);
  }

  properties._id = { type: PropertyTypes.ID };

  const map = new Map<string, Property>();
  const adapter = model.getAdapter(false);

  Object.entries(properties).forEach(([slug, def]) => {
    const property = getPropertyFromDefinition(def, adapter, slug);

    if (property) {
      map.set(slug, property);
    }
  });

  return map;
};

/**
 * The function `createValidatorsArray` takes a model and returns an
 * array of validators based on the model.
 * @param model - The `model` parameter is the type of the model for which validators are being
 * created. It is of type `typeof Model`.
 * @returns The function `createValidatorsArray` returns an array of `Validator` objects.
 */
export const createValidatorsArray = (model: typeof Model): Array<Validator | null> => {
  let validators: Array<Readonly<ValidatorDefinition>> = Array.from(model.configuration.validators || []);

  const keyProperty = model.configuration.keyProperty;
  if (keyProperty && keyProperty !== "_id") {
    validators.push({
      type: ValidatorTypes.KEY_PROPERTY,
      options: { property: keyProperty },
    });

    validators = validators.filter(v => {
      if (v.type === ValidatorTypes.UNIQUE && v.options?.property === keyProperty) {
        return false;
      }

      if (v.type === ValidatorTypes.REQUIRED && v.options?.property === keyProperty) {
        return false;
      }

      return true;
    });
  }

  const adapter = model.getAdapter(false);

  return validators.map(def => getValidatorFromDefinition(def, adapter, undefined));
};

/**
 * The getPropertyClass function returns the appropriate Property class based on the given type and adapter.
 * @param {PropertyTypes} type - The `type` parameter is of type `PropertyTypes`. It represents the type of
 * property that is being requested.
 * @param {Adapter} [adapter] - The `adapter` parameter is an optional parameter of type `Adapter`. It
 * is used to provide a custom mapping of property types to property classes. If provided, the `adapter`
 * object should have a `propertiesMap` property which is an object mapping property types to property classes.
 * @returns The function `getPropertyClass` returns the value of the variable `PropertyClass`.
 */
export const getPropertyClass = <T extends PropertyTypes>(type: T, adapter?: Adapter): typeof Property<T> => {
  let PropertyClass: typeof Property<T> | undefined;

  if (type === PropertyTypes.DEFAULT) {
    PropertyClass = Property;
  } else {
    PropertyClass = adapter?.base?.propertiesMap[type];
  }

  PropertyClass ??= Adapter.propertiesMap[type];
  PropertyClass ??= Property;

  return PropertyClass;
};

/**
 * The function `getValidatorClass` returns the appropriate validator class based on the provided type
 * and adapter.
 * @param {ValidatorTypes} type - The `type` parameter is a string that represents the type of
 * validator class to retrieve. It is used to determine which validator class to return from the
 * `validatorsMap` object.
 * @param {Adapter} [adapter] - The `adapter` parameter is an optional object that contains a
 * `validatorsMap` property. This `validatorsMap` property is an object that maps `ValidatorTypes` to
 * their corresponding validator classes.
 * @returns The function `getValidatorClass` returns the `ValidatorClass` which is a class that extends
 * `Validator<any>`.
 */
export const getValidatorClass = <T extends ValidatorTypes>(type: T, adapter?: Adapter): typeof Validator<T> => {
  let ValidatorClass: typeof Validator<T> | undefined = adapter?.base.validatorsMap?.[type];

  if (!ValidatorClass) {
    ValidatorClass = Adapter.validatorsMap[type];
  }

  if (!ValidatorClass) {
    ValidatorClass = Validator;
  }

  return ValidatorClass;
};

/**
 * The function `getPropertyFromDefinition` takes a property definition, an adapter, and a path, and returns
 * a property object based on the definition.
 * @param def - The `def` parameter is a PropertyDefinition object that describes the property. It can be of
 * type `PropertyOptionsMap` or `PropertyTypes`.
 * @param {Adapter} adapter - The `adapter` parameter is an object that represents an adapter. It is
 * used to provide additional functionality or customization for the `getPropertyFromDefinition` function.
 * @param {string} path - The `path` parameter is a string that represents the path to the property. It is
 * used to uniquely identify the property in the cache.
 * @returns an instance of the `PropertyClass` which is created using the `def` and `path` parameters.
 */
export const getPropertyFromDefinition = <T extends keyof PropertyOptionsMap | PropertyTypes>(
  def: PropertyDefinitionGeneric<T>,
  adapter: Adapter,
  path: string,
): Property<T> | null => {
  if (!def || typeof def !== "object") {
    return null;
  }

  const cacheKey = path;

  if (adapter?.cachePropertiesMap?.has(cacheKey)) {
    return adapter.cachePropertiesMap.get(cacheKey) as Property<T>;
  }

  const PropertyClass = getPropertyClass(def.type as PropertyTypes, adapter) as typeof Property<T>;

  const property = new PropertyClass(def, path);

  if (adapter) {
    adapter.cachePropertiesMap.set(cacheKey, property);
  }

  return property;
};

/**
 * The function `getValidatorFromDefinition` takes a validator definition, an adapter, and a path, and
 * returns a validator instance based on the definition.
 * @param def - The `def` parameter is a ValidatorDefinition object that defines the type of validator
 * and its options. It is of type `ValidatorDefinition<T>`, where `T` is a generic type that extends
 * `ValidatorTypes`.
 * @param {Adapter} adapter - The `adapter` parameter is an object that provides additional
 * functionality or customization options for the validator. It is optional and can be `null` if not
 * needed.
 * @param {string} path - A string representing the path to the validator.
 * @returns an instance of the `Validator` class.
 */
export const getValidatorFromDefinition = <T extends ValidatorTypes>(
  def: ValidatorDefinitionGeneric<T>,
  adapter: Adapter,
  path?: string,
) => {
  if (!def || typeof def !== "object") {
    return null;
  }

  // const cacheKey = path + def.type + def.options?.property;

  // if (adapter?.cacheValidatorsMap?.has(cacheKey)) {
  //   return adapter.cacheValidatorsMap.get(cacheKey);
  // }

  const ValidatorClass = getValidatorClass(def.type as ValidatorTypes, adapter) as typeof Validator<T>;

  const validator = new ValidatorClass(def, path);

  // if (adapter) {
  //   adapter.cacheValidatorsMap ??= new Map();
  //   adapter.cacheValidatorsMap.set(cacheKey, validator);
  // }

  return validator;
};

/**
 * The function `getDefaultValidatorOptions` returns default options based on the provided validator
 * type.
 * @param {T} type - The `type` parameter is a generic type `T` that extends `ValidatorTypes`. It is
 * used to determine the type of validator options to return.
 * @returns The function `getDefaultValidatorOptions` returns a `ValidatorOptions` object based on the
 * input `type`. If the `type` is `ValidatorTypes.LENGTH` or `ValidatorTypes.BOUNDARIES`, it returns an
 * object with `min` set to `-Infinity` and `max` set to `Infinity`. For any other `type`, it returns
 * an empty object.
 */
export const getDefaultValidatorOptions = <T extends ValidatorTypes>(type: T): ValidatorOptions<T> => {
  switch (type) {
    case ValidatorTypes.LENGTH:
    case ValidatorTypes.BOUNDARIES:
      return {
        min: -Infinity,
        max: Infinity,
      } as ValidatorOptions<T>;
    default:
      return {} as ValidatorOptions<T>;
  }
};

/**
 * The function `isObjectId` checks if the input is a valid id.
 * @param input - The `input` parameter is a string or number that represents an id.
 * @returns The function `isObjectId` returns a boolean value indicating whether the input is a valid id.
 */
export const isObjectId = (input: unknown) => /^[a-f\d]{24}$/i.test(String(input));

/**
 * The function `definePropertiesObject` defines properties on an instance object based on the properties
 * of a model.
 * @param {Model} instance - The `instance` parameter is an object of type `Model`.
 * @returns There is no explicit return statement in the code provided. Therefore, the function
 * `definePropertiesObject` does not return anything.
 */
export const definePropertiesObject = (instance: Model) => {
  Object.defineProperties(instance, (instance as ModelInstance).model().propertiesObject);
};

const _pathReplace = (property: Property, p: PropertiesPathItem, fp: string) => {
  return p.property.path.replace(property.path, fp);
};

/**
 * The `_getter` function is a helper function that retrieves values from an object based on a given
 * set of properties and paths.
 * @param opts - The `opts` parameter is an object that contains the following properties:
 * - `value` - The `value` property is the value to be retrieved from the object. It is of type
 * `any`.
 * - `propertiesPaths` - The `propertiesPaths` property is an array of `PropertiesPathItem` objects. It is used
 * to determine which properties to retrieve from the object.
 * - `lastProperty` - The `lastProperty` property is the last property in the `propertiesPaths` array. It is of
 * type `Property`.
 * - `noPropertySymbol` - The `noPropertySymbol` property is a symbol that is used to indicate that a property
 * does not exist.
 * - `format` - The `format` property is a string that represents the format of the value to be
 * retrieved. It is of type `SerializerFormat`.
 * - `ctx` - The `ctx` property is an object that represents the context of the value to be retrieved.
 * - `from` - The `from` property is the model from which the value is being retrieved. It is of type
 * @returns the value obtained by traversing through the `_propertiesPaths` array and accessing the
 * corresponding properties in the `_value` object. If at any point the value is `undefined` or `null`,
 * it returns that value. If the current property is the last property or the format is `OBJECT` and the
 * current property's `nextPropertyEqObject` property is `true`, it serializes the value using the current
 * property's `serialize` method and returns the serialized value. Otherwise, it returns the value
 * obtained by traversing through the `_propertiesPaths` array and accessing the corresponding properties
 * in the `_value` object.
 */
export const _getter = (opts: {
  value?: unknown;
  propertiesPaths: Array<{ key: string; property: Property } | null>;
  noPropertySymbol: symbol;
  format: SerializerFormat;
  ctx: SerializerCtx;
  from: ModelInstance;
  override?: unknown;
}): unknown => {
  let { value } = opts;
  const { propertiesPaths, noPropertySymbol, format, from, ctx } = opts;

  opts.override ??= value; // Keep the original value for the nextData, even when _getter is called recursively

  for (let i = 0; i < propertiesPaths.length; i++) {
    const propertiesPath = propertiesPaths[i];
    if (!propertiesPath) {
      throw noPropertySymbol;
    }

    const { key, property } = propertiesPath;

    if (!property) {
      throw noPropertySymbol;
    }

    const restPaths = propertiesPaths.slice(i + 1);
    const matchIndex = key.match(/\[(\d+)?\]/);
    if (matchIndex) {
      const arrVal: Array<unknown> = Array.isArray(value) ? value : Array.from(value as Iterable<unknown>);

      if (matchIndex[1] === undefined) {
        const adapter = from.model().getAdapter();

        return arrVal.map((v: unknown, fi: number): unknown => {
          const thisPath = property.path.replace(/\[\]$/, `[${fi}]`);
          const _restPaths = restPaths.map(p => {
            if (!p?.property) {
              return p;
            }

            const _f = getPropertyFromDefinition(p.property.definition, adapter, _pathReplace(property, p, thisPath));

            if (!_f) {
              return p;
            }

            return {
              ...p,
              property: _f,
            };
          });

          return _getter({
            ...opts,
            value: v,
            propertiesPaths: _restPaths,
          });
        });
      }

      const index = parseInt(matchIndex[1], 10);

      if (arrVal.length <= index) {
        throw noPropertySymbol;
      }

      return _getter({
        ...opts,
        value: arrVal[index],
        propertiesPaths: restPaths,
      });
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    let n: unknown;
    // @ts-expect-error __raw exists in the proxy returned by nested property
    const raw = value.__raw as (_key: string) => unknown;

    if (typeof raw === "function") {
      n = raw(key);
    } else if (key in value) {
      n = value[key as keyof typeof value];
    }

    if (n === undefined && "default" in property.options && (ctx?.defaults ?? true)) {
      n = property.options.default as typeof n;
    }

    if (n === undefined || n === null || n === PropertyObject.symbolIgnore) {
      if (n === PropertyObject.symbolIgnore && format !== "validation") {
        return undefined;
      }

      return n;
    }

    ctx.hasNext = !!restPaths?.length;

    value = property.serialize({ value: n, format, from, ctx, nextData: opts.override as ModelData });
  }

  return value;
};

/**
 * The function `getNestedPropertiesArrayForModel` recursively retrieves all nested properties for a given
 * model.
 * @param model - The `model` parameter is the type of the model for which we want to retrieve the
 * nested properties array.
 * @returns The function `getNestedPropertiesArrayForModel` returns an array of `Property` objects.
 */
export const getNestedPropertiesArrayForModel = (model: typeof Model): Array<Property> => {
  const res: Array<Property> = [];

  crossProperties({ model }, property => {
    res.push(property);
  });

  return res;
};

/**
 * The function `validateValidators` asynchronously validates a set of validators on a given model and
 * adds any validation errors to a set.
 * @param  - - `validators`: An array of tuples, where each tuple contains a `Validator` object and an
 * array of `ModelInstance` objects.
 */
async function validateProperties<T extends typeof Model>(opts: {
  properties: Array<Property>;
  on: Array<ModelInstance<T>>;
  model: T;
  ctx?: TransactionCtx;
  errorsPropertiesSet: Set<ValidationPropertyError>;
  propertiesValidators: Array<[Validator, Array<ModelInstance<T>>]>;
  propertiesValidatorsKeys: Set<string>;
}) {
  const { properties, on, model, ctx, errorsPropertiesSet, propertiesValidators, propertiesValidatorsKeys } = opts;

  for (const property of properties) {
    const { type, path } = property;

    try {
      // Validate method could be not implemented on Property class
      if (property.validate) {
        const validated = await property.validate({ list: on as Array<ModelInstance>, model, ctx });
        if (!validated) {
          throw null;
        }
      }

      if (type === PropertyTypes.OBJECT) {
        const values = on
          .map(i => i.get(path, "validation"))
          .flat(Infinity)
          .filter(Boolean);

        if (values?.length) {
          const _property = property as Property<PropertyTypes.OBJECT>;
          const o = _property.options || {};
          if (o.additionalProperties) {
            const noProperty = values
              .map(v => {
                if (!v || typeof v !== "object") {
                  return [];
                }

                return Object.keys(v).filter(k => !o.properties?.[k]);
              })
              .flat();

            if (noProperty?.length) {
              const adapter = model.getAdapter();
              const _process = async (_path: string, _list: Array<ModelInstance<T>>) => {
                const tmpProperty =
                  o.additionalProperties && getPropertyFromDefinition(o.additionalProperties, adapter, _path);

                if (!tmpProperty) {
                  return;
                }

                const promises = [
                  validateProperties({
                    ...opts,
                    properties: [tmpProperty],
                    on: _list,
                  }),
                ];

                if (tmpProperty?.type === PropertyTypes.OBJECT) {
                  const properties = getNestedPropertiesMap(model, tmpProperty as Property<PropertyTypes.OBJECT>);

                  promises.push(
                    validateProperties({
                      ...opts,
                      properties: Array.from(properties.values()),
                      on: _list,
                    }),
                  );
                }

                await Promise.all(promises);
              };

              await Promise.all(
                noProperty.map(async k => {
                  const path = _property.path + `.${k}`;

                  const valuesMap = new Map<string, { list: Array<ModelInstance<T>>; arrayLength?: number }>();

                  on.forEach(i => {
                    const value = i.get(path, "validation");
                    if (value && !(Array.isArray(value) && value.length === 0)) {
                      const str = JSON.stringify({ value });
                      let entry = valuesMap.get(str);
                      if (!entry) {
                        entry = {
                          list: [],
                          arrayLength: Array.isArray(value) ? value.length : undefined,
                        };
                        valuesMap.set(str, entry);
                      }
                      entry.list.push(i);
                    }
                  });

                  if (valuesMap.size) {
                    await Promise.all(
                      Array.from(valuesMap.values()).map(async i => {
                        if (i.arrayLength !== undefined) {
                          await Promise.all(
                            [...Array(i.arrayLength)].map((_, j) => _process(path.replace(/\[\]/, `[${j}]`), i.list)),
                          );
                        } else {
                          await _process(path, i.list);
                        }
                      }),
                    );
                  }
                }),
              );
            }
          }

          getNestedValidatorsArray(model, _property).forEach(v => {
            const key = v.getKey();
            if (!propertiesValidatorsKeys.has(key)) {
              propertiesValidators.push([v, on]);
              propertiesValidatorsKeys.add(key);
            }
          });
        }
      }

      if (type === PropertyTypes.ARRAY) {
        const _property = property as Property<PropertyTypes.ARRAY>;
        const entries = on.map(i => [i, i.get(path, "validation")]).filter(e => Boolean(e[1])) as Array<
          [ModelInstance<T>, unknown]
        >;
        const values = entries
          .map(e => e[1])
          .flat(Infinity)
          .filter(Boolean);

        if (values?.length) {
          const validators = getArrayValidatorsArray(model, _property);
          const _on = entries.map(e => e[0]);

          validators.forEach(v => {
            const key = v.getKey();
            if (!propertiesValidatorsKeys.has(key)) {
              propertiesValidators.push([v, _on]);
              propertiesValidatorsKeys.add(key);
            }
          });

          const properties = getArrayItemsPropertiesMap(model, _property);
          await validateProperties({
            ...opts,
            properties: Array.from(properties.values()),
            on: _on,
          });
        }
      }
    } catch (err) {
      let e: ValidationPropertyError;

      if (err instanceof ValidationPropertyError) {
        e = err;
      } else {
        e = new ValidationPropertyError({
          slug: property.path.split(".").pop() as string,
          property,
          validationError: err instanceof ValidationError ? err : undefined,
          message: (err as Error)?.message,
        });
      }

      errorsPropertiesSet.add(e);
    }
  }
}

/**
 * The function `validateValidators` asynchronously validates a set of validators on a given model and
 * adds any validation errors to a set.
 * @param  - - `validators`: An array of tuples, where each tuple contains a `Validator` object and an
 * array of `ModelInstance` objects.
 */
async function validateValidators<T extends typeof Model>({
  validators,
  model,
  ctx,
  errorsValidatorsSet,
}: {
  validators: Array<[Validator, Array<ModelInstance<T>>]>;
  model: T;
  ctx?: TransactionCtx;
  errorsValidatorsSet: Set<ValidationValidatorError>;
}) {
  await Promise.all(
    validators.map(async ([validator, on]) => {
      try {
        const validated = await validator?.validate?.({
          list: on,
          model,
          ctx,
        });

        if (!validated) {
          throw null;
        }
      } catch (err) {
        let e: ValidationValidatorError;

        if (err instanceof ValidationValidatorError) {
          e = err;
        } else {
          e = new ValidationValidatorError({
            validator,
            message: (err as Error)?.message,
          });
        }

        errorsValidatorsSet.add(e);
      }
    }),
  );
}

/**
 * The `validateModel` function is a TypeScript function that validates a list of model instances
 * against their defined properties and validators, throwing a `ValidationError` if any errors are found.
 * @param {T} model - The `model` parameter is the type of the model that you want to validate. It
 * should be a subclass of the `Model` class.
 * @param list - The `list` parameter is an array of either `ModelInstance<T>` or `ModelData<T>`.
 * @param {TransactionCtx} [ctx] - The `ctx` parameter is an optional parameter of type
 * `TransactionCtx`. It is used to pass a transaction context to the validation process. This allows
 * the validation to be performed within a transaction, ensuring that any changes made during the
 * validation can be rolled back if necessary. If no transaction context is provided
 * @returns a boolean value of `true`.
 */
export const validateModel = async <T extends typeof Model>(
  model: T,
  list: Array<Partial<ModelData<T>> | ModelInstance<T>>,
  ctx?: TransactionCtx,
) => {
  const errorsPropertiesSet = new Set<ValidationPropertyError>();
  const errorsValidatorsSet = new Set<ValidationValidatorError>();
  const propertiesValidatorsKeys = new Set<string>();
  const propertiesValidators: Array<[Validator, Array<ModelInstance<T>>]> = [];

  const instances = list.map(i => (i instanceof Model ? i : model.hydrate(i))) as Array<ModelInstance<T>>;

  const promises: Array<Promise<void>> = [
    validateProperties({
      properties: getNestedPropertiesArrayForModel(model),
      on: instances,
      model,
      ctx,
      errorsPropertiesSet,
      propertiesValidators,
      propertiesValidatorsKeys,
    }),
  ];

  if (model.validatorsArray?.length) {
    const validatorsArray = model.validatorsArray.filter(Boolean) as Array<Validator>;
    promises.push(
      validateValidators({
        validators: validatorsArray.map(v => [v, instances]),
        model,
        ctx,
        errorsValidatorsSet,
      }),
    );
  }

  await Promise.all(promises);

  if (propertiesValidatorsKeys.size && !errorsPropertiesSet.size && !errorsValidatorsSet.size) {
    await validateValidators({
      validators: propertiesValidators,
      model,
      ctx,
      errorsValidatorsSet,
    });
  }

  if (errorsPropertiesSet.size || errorsValidatorsSet.size) {
    throw new ValidationError({
      properties: Array.from(errorsPropertiesSet),
      validators: Array.from(errorsValidatorsSet),
      model: model.configuration.slug,
    });
  }

  return true;
};

/**
 * The `crossProperties` function recursively iterates over properties in a model and calls a callback function
 * for each property.
 * @param opts - - `model`: The model object that contains the properties.
 * @param cb - The `cb` parameter is a callback function that takes a `property` parameter and returns
 * either `void` or a `Promise<void>`. This callback function is called for each property in the
 * `propertiesMap`.
 * @returns The function `crossProperties` is returning itself.
 */
export const crossProperties = (
  opts: {
    model: typeof Model;
    propertiesMap?: Map<string, Property>;
  },
  cb: (_property: Property) => void | Promise<void>,
) => {
  const { model } = opts;
  const propertiesMap = opts.propertiesMap || opts.model.propertiesMap;

  const results: Array<void | Promise<void>> = [];

  propertiesMap.forEach(property => {
    results.push(cb(property));

    if (property.type === PropertyTypes.ARRAY) {
      crossProperties(
        {
          model,
          propertiesMap: getArrayItemsPropertiesMap(model, property as Property<PropertyTypes.ARRAY>),
        },
        cb,
      );
    } else if (property.type === PropertyTypes.OBJECT) {
      crossProperties(
        {
          model,
          propertiesMap: getNestedPropertiesMap(model, property as Property<PropertyTypes.OBJECT>),
        },
        cb,
      );
    }
  });

  return results;
};

export const assignDatamodel = async <T extends typeof Model>(model: T, datamodel: ModelJSON<typeof DataModel>) => {
  const baseClass = model.getBaseClass();

  model.configuration.realtime = Boolean(baseClass.configuration.realtime) || Boolean(datamodel?.realtime) || false;

  const properties: PropertiesDefinition = {};

  if (baseClass.configuration.properties) {
    Object.assign(properties, baseClass.configuration.properties);
  }

  if (datamodel?.properties) {
    Object.assign(properties, datamodel.properties);
  }

  const validators: ValidatorsDefinition = [];

  if (baseClass.configuration.validators?.length) {
    validators.push(...baseClass.configuration.validators);
  }

  if (datamodel?.validators?.length) {
    validators.push(...datamodel.validators);
  }

  model.configuration = {
    ...model.configuration,
    keyProperty: baseClass.configuration.keyProperty || datamodel?.keyProperty || undefined,
    single: datamodel?.single || false,
    properties,
    validators,
  };

  model.__memo = {};

  model.getAdapter(false)?.resetPropertiesCache();
};

export const getModelInitPromise = (
  model: typeof Model,
  opts: {
    datamodel?: ModelJSON<typeof DataModel>;
    ctx?: TransactionCtx;
  },
) => {
  const transaction: Transaction<typeof Model, "initialize"> = {
    model: model.configuration.slug,
    action: "initialize",
    args: undefined as never,
    retryToken: undefined,
    abortToken: undefined,
    retries: 0,
  };

  return new Promise<void>(async (resolve, reject) => {
    try {
      const hooksBefore = getRecursiveHooksFromModel(model, "initialize", "before");

      await hooksBefore.reduce(async (p, hook) => {
        await p;
        return hook.fn.call(model, { args: undefined as never, transaction, ctx: {}, err: [] });
      }, Promise.resolve());

      if (model.configuration.loadDatamodel || opts?.datamodel) {
        await model.reloadModel({ datamodel: opts?.datamodel, ctx: opts?.ctx });
      }

      const hooksAfter = getRecursiveHooksFromModel(model, "initialize", "after");

      await hooksAfter.reduce(async (p, hook) => {
        await p;
        return hook.fn.call(model, { args: undefined as never, transaction, ctx: {}, err: [], res: undefined });
      }, Promise.resolve());
    } catch (e) {
      return reject(e);
    }

    resolve();
  });
};

export const isValidPropertyDefinition = (def: PropertyDefinition) => {
  if (def.type === PropertyTypes.RELATION) {
    const _def = def as PropertyDefinitionGeneric<PropertyTypes.RELATION>;
    if (!_def.options?.ref) {
      return false;
    }
  }

  return true;
};

export const validateDatamodel = (data: ModelJSON<typeof DataModel>, adapter?: Adapter) => {
  const slug = data?.slug;
  const modelsMap = adapter?.base.getRecursiveModelsMap() || Adapter.getRecursiveModelsMap();

  if (slug && modelsMap.has(slug) && !modelsMap.get(slug)?.configuration.loadDatamodel) {
    throw new Error(`model slug "${slug}" is reserved`);
  }

  const properties = data?.properties;

  if (properties) {
    const keys = Object.keys(properties || {});

    if (keys.length > 100) {
      throw new Error(`properties limit is 100`);
    }

    const regex = new RegExp(Patterns.PROPERTY);
    for (const key of keys) {
      if (key in Model.prototype) {
        throw new Error(`property name "${key}" is reserved`);
      }

      if (!regex.test(key)) {
        throw new Error(`invalid property name "${key}"`);
      }
    }

    Object.entries(properties).forEach(([key, def]) => {
      if (!isValidPropertyDefinition(def as PropertyDefinition)) {
        throw new Error(`invalid definition for property "${key}"`);
      }
    });
  }

  const keyProperty = data?.keyProperty;

  if (keyProperty) {
    const keyPropertyProperty = properties?.[keyProperty];

    if (!keyPropertyProperty) {
      throw new Error(`keyProperty not found in properties`);
    }

    if (keyPropertyProperty.type !== PropertyTypes.TEXT) {
      throw new Error(`keyProperty must be a text property`);
    }

    if (
      typeof keyPropertyProperty?.options === "object" &&
      keyPropertyProperty.options &&
      "default" in keyPropertyProperty.options &&
      keyPropertyProperty.options.default !== undefined
    ) {
      throw new Error(`keyProperty must not have a default value`);
    }
  }

  return true;
};

/**
 * The function `getValidationValues` returns an array of values for a given path in a list of model instances.
 * The values are flattened and filtered out any falsy values to simplify the validation process.
 * @param list - The `list` parameter is an array of model instances.
 * @param path - The `path` parameter is a string that represents the path to the property.
 * @returns The function `getValidationValues` returns an array of values from a given list to test on a specific path.
 */
export const getValidationValues = (list: Array<ModelInstance<typeof Model>>, path: string) => {
  let level = 0;
  let index = -1;

  while ((index = path.indexOf("[]", index + 1)) !== -1) {
    level++;
  }

  let values: Array<unknown> = list.map(i => i.get(path, "validation"));

  if (level) {
    values = values.flat(level);
  }

  values = values.filter(v => v !== PropertyObject.symbolIgnore);

  return values;
};

export const createValidationError = (
  definition: ValidatorDefinition,
  opts?: {
    model?: string;
    path?: string;
    value?: string;
    message?: string;
  },
) => {
  return new ValidationError({
    model: opts?.model,
    validators: [
      new ValidationValidatorError({
        validator: new Validator(definition, opts?.path),
        message: opts?.message,
        value: opts?.value,
      }),
    ],
  });
};
