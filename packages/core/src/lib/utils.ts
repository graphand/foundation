import { Model } from "@/lib/model.js";
import {
  AdapterFetcher,
  FieldDefinitionGeneric,
  FieldOptionsMap,
  FieldsPathItem,
  Hook,
  HookPhase,
  ModelInstance,
  ValidatorDefinitionGeneric,
  ValidatorOptions,
  FieldOptions,
  SerializerFormat,
  SerializerCtx,
  TransactionCtx,
  FieldsDefinition,
  Transaction,
  ModelJSON,
  ModelData,
  ValidatorDefinition,
  FieldDefinition,
  ValidatorsDefinition,
} from "@/types/index.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/field.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { Adapter } from "@/lib/adapter.js";
import { ValidationValidatorError } from "@/lib/validation-validator-error.js";
import { ValidationFieldError } from "@/lib/validation-field-error.js";
import { ValidationError } from "@/lib/validation-error.js";
import type { DataModel } from "@/models/data-model.js";
import { Patterns } from "@/enums/patterns.js";
import { FieldObject } from "./fields/object.js";

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
 * string. It represents the path to a specific field in the model.
 * @returns { Promise<Array<typeof Model>> } The function `getRelationModelsFromPath` returns an array of `typeof Model` objects
 * representing the relation models found in the path.
 */
export const getRelationModelsFromPath = async (
  model: typeof Model,
  pathArr: Array<string> | string,
): Promise<Array<typeof Model>> => {
  await model.initialize();
  pathArr = Array.isArray(pathArr) ? pathArr : pathArr.split(".");
  const fields = getFieldsPathsFromPath(model, pathArr);
  const relationModels: Set<string> = new Set();

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];

    if (!field) {
      break;
    }

    const isLast = i === fields.length - 1;
    if (field.field.type === FieldTypes.RELATION) {
      const options = field.field.options as FieldOptions<FieldTypes.RELATION>;
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
 * The function `getFieldsPathsFromPath` takes a model and a path array or string as input and returns
 * an array of the decomposed fields path.
 * @param model - The `model` parameter is the type of the model that contains the fields. It is of
 * type `typeof Model`.
 * @param {Array<string> | string} pathArr - The `pathArr` parameter is either an array of strings or a
 * string. It represents the path to a specific field in the model.
 * @returns The function `getFieldsPathsFromPath` returns an array of `FieldsPathItem` objects.
 */
export const getFieldsPathsFromPath = (
  model: typeof Model,
  pathArr: Array<string> | string,
): Array<FieldsPathItem | null> => {
  const paths = Array.isArray(pathArr) ? pathArr : pathArr.split(".");
  const firstFieldKey = paths[0];
  if (!firstFieldKey) {
    return [];
  }

  const firstField = model.fieldsMap?.get(firstFieldKey);
  const adapter = model.getAdapter(false);

  const result: Array<FieldsPathItem | null> = firstField ? [{ key: firstFieldKey, field: firstField }] : [null];

  if (paths.length === 1) {
    return result;
  }

  for (let i = 1; i < paths.length; i++) {
    const key = paths[i] as string;
    const prevField = result[result.length - 1]?.field;
    const pathStr = result.map(item => item?.key).join(".");

    if (prevField?.type === FieldTypes.ARRAY) {
      const options = prevField.options as FieldOptions<FieldTypes.ARRAY>;
      const matchIndex = key.match(/\[(\d+)?\]/);

      if (matchIndex) {
        const index = matchIndex[1] ? parseInt(matchIndex[1], 10) : null;
        if (index !== null) {
          const itemsField = getFieldFromDefinition(options.items, adapter, `${pathStr}.[${index}]`);
          if (itemsField) {
            result.push({ key: `[${index}]`, field: itemsField });
          } else {
            result.push(null);
          }
          continue;
        }
      }

      const itemsField = getFieldFromDefinition(options.items, adapter, `${pathStr}.[]`);
      if (itemsField) {
        result.push({ key: "[]", field: itemsField });
      } else {
        result.push(null);
      }

      if (matchIndex) continue;

      if (itemsField?.type === FieldTypes.OBJECT) {
        const nestedOptions = itemsField.options as FieldOptions<FieldTypes.OBJECT>;
        const nextFieldDef = nestedOptions?.fields?.[key];
        if (!nextFieldDef) {
          result.push(null);
          continue;
        }

        const nextField = getFieldFromDefinition(nextFieldDef, adapter, `${pathStr}.[].${key}`);
        if (nextField) {
          result.push({ key, field: nextField });
          continue;
        }
      }
    }

    if (prevField?.type === FieldTypes.OBJECT) {
      const options = prevField.options as FieldOptions<FieldTypes.OBJECT>;
      let nextFieldDef = options.fields?.[key] || options.defaultField;
      if (nextFieldDef === undefined && !options.strict) {
        nextFieldDef = {
          type: FieldTypes.DEFAULT,
        };
      }

      if (!nextFieldDef) {
        result.push(null);
        continue;
      }

      const nextField = getFieldFromDefinition(nextFieldDef, adapter, `${pathStr}.${key}`);
      if (nextField) {
        result.push({ key, field: nextField });
        continue;
      }
    }

    if (prevField?.type === FieldTypes.DEFAULT) {
      const nextField = getFieldFromDefinition(
        {
          type: FieldTypes.DEFAULT,
        },
        adapter,
        `${pathStr}.${key}`,
      );

      if (nextField) {
        result.push({ key, field: nextField });
        continue;
      }
    }

    if (prevField?.type === FieldTypes.RELATION) {
      const options = prevField.options as FieldOptions<FieldTypes.RELATION>;
      const refModel = Model.getClass(options.ref, adapter.base);
      const restPaths = paths.slice(i);
      const nextFields = getFieldsPathsFromPath(refModel, restPaths);
      result.push(...nextFields);
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
 * The function `getNestedFieldsMap` takes a model and a nested field as input, and returns a map of
 * the nested fields within the given field.
 * @param model - The `model` parameter is the type of the model that contains the nested field. It is
 * of type `typeof Model`.
 * @param nestedField - The `nestedField` parameter is of type `Field<FieldTypes.OBJECT>`. It
 * represents a nested field in a model.
 * @returns The function `getNestedFieldsMap` returns a `Map` object.
 */
export const getNestedFieldsMap = (model: typeof Model, nestedField: Field<FieldTypes.OBJECT>) => {
  const adapter = model.getAdapter(false);
  const map = new Map<string, Field>();

  Object.entries(nestedField.options.fields ?? {}).forEach(([slug, def]) => {
    const field = getFieldFromDefinition(def, adapter, nestedField.path + "." + slug);

    if (field) {
      map.set(slug, field);
    }
  });

  return map;
};

/**
 * The function `getNestedValidatorsArray` returns an array of validators for a nested field in a
 * model.
 * @param model - The `model` parameter is the type of the model that contains the nested field. It is
 * of type `typeof Model`.
 * @param nestedField - The `nestedField` parameter is of type `Field<FieldTypes.OBJECT>`. It
 * represents a nested field in a model.
 * @returns an array of validators.
 */
export const getNestedValidatorsArray = (model: typeof Model, nestedField: Field<FieldTypes.OBJECT>) => {
  const adapter = model.getAdapter(false);
  const validators: Array<Validator> = [];

  nestedField.options.validators?.forEach(def => {
    const validator = getValidatorFromDefinition(def, adapter, nestedField.path);

    if (validator) {
      validators.push(validator);
    }
  });

  return validators;
};

/**
 * The function `getArrayItemsFieldsMap` takes a model and an array field as input, and returns a map
 * of the fields within the array.
 * @param model - The `model` parameter is the model class that represents a database table or
 * collection. It is of type `typeof Model`.
 * @param arrayField - The `arrayField` parameter is a field of type `FieldTypes.ARRAY`. It represents
 * an array field in a model.
 * @returns a Map object.
 */
export const getArrayItemsFieldsMap = (model: typeof Model, arrayField: Field<FieldTypes.ARRAY>) => {
  const adapter = model.getAdapter();
  const map = new Map();

  const itemsField = getFieldFromDefinition(arrayField.options.items, adapter, arrayField.path + ".[]");

  if (itemsField) {
    map.set("[]", itemsField);
  }

  return map;
};

/**
 * The function `getArrayValidatorsArray` returns an array of validators for a given array field in a
 * model.
 * @param model - The `model` parameter is the type of the model that contains the array field. It is
 * of type `typeof Model`.
 * @param arrayField - The `arrayField` parameter is of type `Field<FieldTypes.ARRAY>`. It represents a
 * field in a model that is of type array.
 * @returns an array of validators.
 */
export const getArrayValidatorsArray = (model: typeof Model, arrayField: Field<FieldTypes.ARRAY>) => {
  const adapter = model.getAdapter();
  const validators: Array<Validator> = [];

  arrayField.options.validators?.forEach(def => {
    const validator = getValidatorFromDefinition(def as ValidatorDefinition, adapter, arrayField.path + ".[]");

    if (validator) {
      validators.push(validator);
    }
  });

  return validators;
};

/**
 * The `createFieldsMap` function creates a map of fields from a model/
 * @param model - The `model` parameter is the type of the model for which you want to create a fields
 * map. It is of type `typeof Model`.
 * @returns The function `createFieldsMap` returns a `Map` object.
 */
export const createFieldsMap = (model: typeof Model): Map<string, Field> => {
  const fields: FieldsDefinition = Object.assign({}, model.configuration.fields);

  if (model.systemFields) {
    Object.assign(fields, model.systemFields);
  }

  fields._id = { type: FieldTypes.ID };

  const map = new Map<string, Field>();
  const adapter = model.getAdapter(false);

  Object.entries(fields).forEach(([slug, def]) => {
    const field = getFieldFromDefinition(def, adapter, slug);

    if (field) {
      map.set(slug, field);
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

  const keyField = model.configuration.keyField;
  if (keyField && keyField !== "_id") {
    validators.push({
      type: ValidatorTypes.KEY_FIELD,
      options: { field: keyField },
    });

    validators = validators.filter(v => {
      if (v.type === ValidatorTypes.UNIQUE && v.options?.field === keyField) {
        return false;
      }

      if (v.type === ValidatorTypes.REQUIRED && v.options?.field === keyField) {
        return false;
      }

      return true;
    });
  }

  const adapter = model.getAdapter(false);

  return validators.map(def => getValidatorFromDefinition(def, adapter, undefined));
};

/**
 * The getFieldClass function returns the appropriate Field class based on the given type and adapter.
 * @param {FieldTypes} type - The `type` parameter is of type `FieldTypes`. It represents the type of
 * field that is being requested.
 * @param {Adapter} [adapter] - The `adapter` parameter is an optional parameter of type `Adapter`. It
 * is used to provide a custom mapping of field types to field classes. If provided, the `adapter`
 * object should have a `fieldsMap` property which is an object mapping field types to field classes.
 * @returns The function `getFieldClass` returns the value of the variable `FieldClass`.
 */
export const getFieldClass = <T extends FieldTypes>(type: T, adapter?: Adapter): typeof Field<T> => {
  let FieldClass: typeof Field<T> | undefined;

  if (type === FieldTypes.DEFAULT) {
    FieldClass = Field;
  } else {
    FieldClass = adapter?.base?.fieldsMap[type];
  }

  FieldClass ??= Adapter.fieldsMap[type];
  FieldClass ??= Field;

  return FieldClass;
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
 * The function `getFieldFromDefinition` takes a field definition, an adapter, and a path, and returns
 * a field object based on the definition.
 * @param def - The `def` parameter is a FieldDefinition object that describes the field. It can be of
 * type `FieldOptionsMap` or `FieldTypes`.
 * @param {Adapter} adapter - The `adapter` parameter is an object that represents an adapter. It is
 * used to provide additional functionality or customization for the `getFieldFromDefinition` function.
 * @param {string} path - The `path` parameter is a string that represents the path to the field. It is
 * used to uniquely identify the field in the cache.
 * @returns an instance of the `FieldClass` which is created using the `def` and `path` parameters.
 */
export const getFieldFromDefinition = <T extends keyof FieldOptionsMap | FieldTypes>(
  def: FieldDefinitionGeneric<T>,
  adapter: Adapter,
  path: string,
): Field<T> | null => {
  if (!def || typeof def !== "object") {
    return null;
  }

  const cacheKey = path;

  if (adapter?.cacheFieldsMap?.has(cacheKey)) {
    return adapter.cacheFieldsMap.get(cacheKey) as Field<T>;
  }

  const FieldClass = getFieldClass(def.type as FieldTypes, adapter) as typeof Field<T>;

  const field = new FieldClass(def, path);

  if (adapter) {
    adapter.cacheFieldsMap.set(cacheKey, field);
  }

  return field;
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

  // const cacheKey = path + def.type + def.options?.field;

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
 * The function `defineFieldsProperties` defines properties on an instance object based on the fields
 * of a model.
 * @param {Model} instance - The `instance` parameter is an object of type `Model`.
 * @returns There is no explicit return statement in the code provided. Therefore, the function
 * `defineFieldsProperties` does not return anything.
 */
export const defineFieldsProperties = (instance: Model) => {
  Object.defineProperties(instance, (instance as ModelInstance).model().fieldsProperties);
};

const _pathReplace = (field: Field, p: FieldsPathItem, fp: string) => {
  return p.field.path.replace(field.path, fp);
};

/**
 * The `_getter` function is a helper function that retrieves values from an object based on a given
 * set of fields and paths.
 * @param opts - The `opts` parameter is an object that contains the following properties:
 * - `value` - The `value` property is the value to be retrieved from the object. It is of type
 * `any`.
 * - `fieldsPaths` - The `fieldsPaths` property is an array of `FieldsPathItem` objects. It is used
 * to determine which fields to retrieve from the object.
 * - `lastField` - The `lastField` property is the last field in the `fieldsPaths` array. It is of
 * type `Field`.
 * - `noFieldSymbol` - The `noFieldSymbol` property is a symbol that is used to indicate that a field
 * does not exist.
 * - `format` - The `format` property is a string that represents the format of the value to be
 * retrieved. It is of type `SerializerFormat`.
 * - `ctx` - The `ctx` property is an object that represents the context of the value to be retrieved.
 * - `from` - The `from` property is the model from which the value is being retrieved. It is of type
 * @returns the value obtained by traversing through the `_fieldsPaths` array and accessing the
 * corresponding properties in the `_value` object. If at any point the value is `undefined` or `null`,
 * it returns that value. If the current field is the last field or the format is `OBJECT` and the
 * current field's `nextFieldEqObject` property is `true`, it serializes the value using the current
 * field's `serialize` method and returns the serialized value. Otherwise, it returns the value
 * obtained by traversing through the `_fieldsPaths` array and accessing the corresponding properties
 * in the `_value` object.
 */
export const _getter = (opts: {
  value?: unknown;
  fieldsPaths: Array<{ key: string; field: Field } | null>;
  noFieldSymbol: symbol;
  format: SerializerFormat;
  ctx: SerializerCtx;
  from: ModelInstance;
  override?: unknown;
}): unknown => {
  let { value } = opts;
  const { fieldsPaths, noFieldSymbol, format, from, ctx } = opts;

  opts.override ??= value; // Keep the original value for the nextData, even when _getter is called recursively

  for (let i = 0; i < fieldsPaths.length; i++) {
    const fieldsPath = fieldsPaths[i];
    if (!fieldsPath) {
      throw noFieldSymbol;
    }

    const { key, field } = fieldsPath;

    if (!field) {
      throw noFieldSymbol;
    }

    const restPaths = fieldsPaths.slice(i + 1);
    const matchIndex = key.match(/\[(\d+)?\]/);
    if (matchIndex) {
      const arrVal: Array<unknown> = Array.isArray(value) ? value : Array.from(value as Iterable<unknown>);

      if (matchIndex[1] === undefined) {
        const adapter = from.model().getAdapter();

        return arrVal.map((v: unknown, fi: number): unknown => {
          const thisPath = field.path.replace(/\[\]$/, `[${fi}]`);
          const _restPaths = restPaths.map(p => {
            if (!p?.field) {
              return p;
            }

            const _f = getFieldFromDefinition(p.field.definition, adapter, _pathReplace(field, p, thisPath));

            if (!_f) {
              return p;
            }

            return {
              ...p,
              field: _f,
            };
          });

          return _getter({
            ...opts,
            value: v,
            fieldsPaths: _restPaths,
          });
        });
      }

      const index = parseInt(matchIndex[1], 10);

      if (arrVal.length <= index) {
        throw noFieldSymbol;
      }

      return _getter({
        ...opts,
        value: arrVal[index],
        fieldsPaths: restPaths,
      });
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    let n: unknown;
    // @ts-expect-error __raw exists in the proxy returned by nested field
    const raw = value.__raw as (_key: string) => unknown;

    if (typeof raw === "function") {
      n = raw(key);
    } else if (key in value) {
      n = value[key as keyof typeof value];
    }

    if (n === undefined && "default" in field.options && (ctx?.defaults ?? true)) {
      n = field.options.default as typeof n;
    }

    if (n === undefined || n === null || n === FieldObject.symbolIgnore) {
      if (n === FieldObject.symbolIgnore && format !== "validation") {
        return undefined;
      }

      return n;
    }

    ctx.hasNext = !!restPaths?.length;

    value = field.serialize({ value: n, format, from, ctx, nextData: opts.override as ModelData });
  }

  return value;
};

/**
 * The function `getNestedFieldsArrayForModel` recursively retrieves all nested fields for a given
 * model.
 * @param model - The `model` parameter is the type of the model for which we want to retrieve the
 * nested fields array.
 * @returns The function `getNestedFieldsArrayForModel` returns an array of `Field` objects.
 */
export const getNestedFieldsArrayForModel = (model: typeof Model): Array<Field> => {
  const res: Array<Field> = [];

  crossFields({ model }, field => {
    res.push(field);
  });

  return res;
};

/**
 * The function `validateValidators` asynchronously validates a set of validators on a given model and
 * adds any validation errors to a set.
 * @param  - - `validators`: An array of tuples, where each tuple contains a `Validator` object and an
 * array of `ModelInstance` objects.
 */
async function validateFields<T extends typeof Model>(opts: {
  fields: Array<Field>;
  on: Array<ModelInstance<T>>;
  model: T;
  ctx?: TransactionCtx;
  errorsFieldsSet: Set<ValidationFieldError>;
  fieldsValidators: Array<[Validator, Array<ModelInstance<T>>]>;
  fieldsValidatorsKeys: Set<string>;
}) {
  const { fields, on, model, ctx, errorsFieldsSet, fieldsValidators, fieldsValidatorsKeys } = opts;

  for (const field of fields) {
    const { type, path } = field;

    try {
      // Validate method could be not implemented on Field class
      if (field.validate) {
        const validated = await field.validate({ list: on as Array<ModelInstance>, model, ctx });
        if (!validated) {
          throw null;
        }
      }

      if (type === FieldTypes.OBJECT) {
        const values = on
          .map(i => i.get(path, "validation"))
          .flat(Infinity)
          .filter(Boolean);

        if (values?.length) {
          const _field = field as Field<FieldTypes.OBJECT>;
          const o = _field.options || {};
          if (o.defaultField) {
            const noField = values
              .map(v => {
                if (!v || typeof v !== "object") {
                  return [];
                }

                return Object.keys(v).filter(k => !o.fields?.[k]);
              })
              .flat();

            if (noField?.length) {
              const adapter = model.getAdapter();
              const _process = async (_path: string, _list: Array<ModelInstance<T>>) => {
                const tmpField = o.defaultField && getFieldFromDefinition(o.defaultField, adapter, _path);

                if (!tmpField) {
                  return;
                }

                const promises = [
                  validateFields({
                    ...opts,
                    fields: [tmpField],
                    on: _list,
                  }),
                ];

                if (tmpField?.type === FieldTypes.OBJECT) {
                  const fields = getNestedFieldsMap(model, tmpField as Field<FieldTypes.OBJECT>);

                  promises.push(
                    validateFields({
                      ...opts,
                      fields: Array.from(fields.values()),
                      on: _list,
                    }),
                  );
                }

                await Promise.all(promises);
              };

              await Promise.all(
                noField.map(async k => {
                  const path = _field.path + `.${k}`;

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

          getNestedValidatorsArray(model, _field).forEach(v => {
            const key = v.getKey();
            if (!fieldsValidatorsKeys.has(key)) {
              fieldsValidators.push([v, on]);
              fieldsValidatorsKeys.add(key);
            }
          });
        }
      }

      if (type === FieldTypes.ARRAY) {
        const _field = field as Field<FieldTypes.ARRAY>;
        const entries = on.map(i => [i, i.get(path, "validation")]).filter(e => Boolean(e[1])) as Array<
          [ModelInstance<T>, unknown]
        >;
        const values = entries
          .map(e => e[1])
          .flat(Infinity)
          .filter(Boolean);

        if (values?.length) {
          const validators = getArrayValidatorsArray(model, _field);
          const _on = entries.map(e => e[0]);

          validators.forEach(v => {
            const key = v.getKey();
            if (!fieldsValidatorsKeys.has(key)) {
              fieldsValidators.push([v, _on]);
              fieldsValidatorsKeys.add(key);
            }
          });

          const fields = getArrayItemsFieldsMap(model, _field);
          await validateFields({
            ...opts,
            fields: Array.from(fields.values()),
            on: _on,
          });
        }
      }
    } catch (err) {
      let e: ValidationFieldError;

      if (err instanceof ValidationFieldError) {
        e = err;
      } else {
        e = new ValidationFieldError({
          slug: field.path.split(".").pop() as string,
          field,
          validationError: err instanceof ValidationError ? err : undefined,
          message: (err as Error)?.message,
        });
      }

      errorsFieldsSet.add(e);
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
 * against their defined fields and validators, throwing a `ValidationError` if any errors are found.
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
  const errorsFieldsSet = new Set<ValidationFieldError>();
  const errorsValidatorsSet = new Set<ValidationValidatorError>();
  const fieldsValidatorsKeys = new Set<string>();
  const fieldsValidators: Array<[Validator, Array<ModelInstance<T>>]> = [];

  const instances = list.map(i => (i instanceof Model ? i : model.hydrate(i))) as Array<ModelInstance<T>>;

  const promises: Array<Promise<void>> = [
    validateFields({
      fields: getNestedFieldsArrayForModel(model),
      on: instances,
      model,
      ctx,
      errorsFieldsSet,
      fieldsValidators,
      fieldsValidatorsKeys,
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

  if (fieldsValidatorsKeys.size && !errorsFieldsSet.size && !errorsValidatorsSet.size) {
    await validateValidators({
      validators: fieldsValidators,
      model,
      ctx,
      errorsValidatorsSet,
    });
  }

  if (errorsFieldsSet.size || errorsValidatorsSet.size) {
    throw new ValidationError({
      fields: Array.from(errorsFieldsSet),
      validators: Array.from(errorsValidatorsSet),
      model: model.configuration.slug,
    });
  }

  return true;
};

/**
 * The `crossFields` function recursively iterates over fields in a model and calls a callback function
 * for each field.
 * @param opts - - `model`: The model object that contains the fields.
 * @param cb - The `cb` parameter is a callback function that takes a `field` parameter and returns
 * either `void` or a `Promise<void>`. This callback function is called for each field in the
 * `fieldsMap`.
 * @returns The function `crossFields` is returning itself.
 */
export const crossFields = (
  opts: {
    model: typeof Model;
    fieldsMap?: Map<string, Field>;
  },
  cb: (_field: Field) => void | Promise<void>,
) => {
  const { model } = opts;
  const fieldsMap = opts.fieldsMap || opts.model.fieldsMap;

  const results: Array<void | Promise<void>> = [];

  fieldsMap.forEach(field => {
    results.push(cb(field));

    if (field.type === FieldTypes.ARRAY) {
      crossFields(
        {
          model,
          fieldsMap: getArrayItemsFieldsMap(model, field as Field<FieldTypes.ARRAY>),
        },
        cb,
      );
    } else if (field.type === FieldTypes.OBJECT) {
      crossFields(
        {
          model,
          fieldsMap: getNestedFieldsMap(model, field as Field<FieldTypes.OBJECT>),
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

  const fields: FieldsDefinition = {};

  if (baseClass.configuration.fields) {
    Object.assign(fields, baseClass.configuration.fields);
  }

  if (datamodel?.fields) {
    Object.assign(fields, datamodel.fields);
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
    keyField: baseClass.configuration.keyField || datamodel?.keyField || undefined,
    single: datamodel?.single || false,
    fields,
    validators,
  };

  model.__memo = {};

  model.getAdapter(false)?.resetFieldsCache();
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

export const isValidFieldDefinition = (def: FieldDefinition) => {
  if (def.type === FieldTypes.RELATION) {
    const _def = def as FieldDefinitionGeneric<FieldTypes.RELATION>;
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

  const fields = data?.fields;

  if (fields) {
    const keys = Object.keys(fields || {});

    if (keys.length > 100) {
      throw new Error(`fields limit is 100`);
    }

    const regex = new RegExp(Patterns.FIELD);
    for (const key of keys) {
      if (key in Model.prototype) {
        throw new Error(`field name "${key}" is reserved`);
      }

      if (!regex.test(key)) {
        throw new Error(`invalid field name "${key}"`);
      }
    }

    Object.entries(fields).forEach(([key, def]) => {
      if (!isValidFieldDefinition(def as FieldDefinition)) {
        throw new Error(`invalid definition for field "${key}"`);
      }
    });
  }

  const keyField = data?.keyField;

  if (keyField) {
    const keyFieldField = fields?.[keyField];

    if (!keyFieldField) {
      throw new Error(`keyField not found in fields`);
    }

    if (keyFieldField.type !== FieldTypes.TEXT) {
      throw new Error(`keyField must be a text field`);
    }

    if (
      typeof keyFieldField?.options === "object" &&
      keyFieldField.options &&
      "default" in keyFieldField.options &&
      keyFieldField.options.default !== undefined
    ) {
      throw new Error(`keyField must not have a default value`);
    }
  }

  return true;
};

/**
 * The function `getValidationValues` returns an array of values for a given path in a list of model instances.
 * The values are flattened and filtered out any falsy values to simplify the validation process.
 * @param list - The `list` parameter is an array of model instances.
 * @param path - The `path` parameter is a string that represents the path to the field.
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

  values = values.filter(v => v !== FieldObject.symbolIgnore);

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
