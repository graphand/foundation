import { AdapterFetcher } from "@/types/index.js";
import { Model } from "@/lib/model.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/field.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { CoreError } from "./core-error.js";
import { FieldId } from "./fields/id.js";
import { FieldNumber } from "./fields/number.js";
import { FieldBoolean } from "./fields/boolean.js";
import { FieldDate } from "./fields/date.js";
import { FieldText } from "./fields/text.js";
import { FieldRelation } from "./fields/relation.js";
import { FieldObject } from "./fields/object.js";
import { FieldIdentity } from "./fields/identity.js";
import { FieldArray } from "./fields/array.js";
import { ValidatorUnique } from "./validators/unique.js";
import { ValidatorRegex } from "./validators/regex.js";
import { ValidatorKeyField } from "./validators/key-field.js";
import { ValidatorDatamodelSlug } from "./validators/datamodel-slug.js";
import { ValidatorDatamodelDefinition } from "./validators/datamodel-definition.js";
import { ValidatorLength } from "./validators/length.js";
import { ValidatorBoundaries } from "./validators/boundaries.js";
import { ValidatorRequired } from "./validators/required.js";
import { FieldInteger } from "./fields/integer.js";
import { FieldEnum } from "./fields/enum.js";

export class Adapter<T extends typeof Model = typeof Model> {
  static __name = "Adapter";

  static fieldsMap: { [T in FieldTypes]?: typeof Field<T> } = {
    [FieldTypes.ID]: FieldId,
    [FieldTypes.NUMBER]: FieldNumber,
    [FieldTypes.INTEGER]: FieldInteger,
    [FieldTypes.BOOLEAN]: FieldBoolean,
    [FieldTypes.DATE]: FieldDate,
    [FieldTypes.TEXT]: FieldText,
    [FieldTypes.ENUM]: FieldEnum,
    [FieldTypes.RELATION]: FieldRelation,
    [FieldTypes.OBJECT]: FieldObject,
    [FieldTypes.IDENTITY]: FieldIdentity,
    [FieldTypes.ARRAY]: FieldArray,
  };
  static validatorsMap: { [T in ValidatorTypes]?: typeof Validator<T> } = {
    [ValidatorTypes.REQUIRED]: ValidatorRequired,
    [ValidatorTypes.UNIQUE]: ValidatorUnique,
    [ValidatorTypes.REGEX]: ValidatorRegex,
    [ValidatorTypes.KEY_FIELD]: ValidatorKeyField,
    [ValidatorTypes.DATAMODEL_SLUG]: ValidatorDatamodelSlug,
    [ValidatorTypes.DATAMODEL_DEFINITION]: ValidatorDatamodelDefinition,
    [ValidatorTypes.LENGTH]: ValidatorLength,
    [ValidatorTypes.BOUNDARIES]: ValidatorBoundaries,
  };
  static runWriteValidators: boolean; // If the adapter should run validators after a model create/update
  static _modelsRegistry: Map<string, typeof Model>;

  fetcher: AdapterFetcher<T> | undefined; // The adapter configuration = how the adapter should process
  model: T; // The model of the current adapter instance

  #cacheFieldsMap: Map<string, Field<FieldTypes>> | undefined; // Cache the fields of the current model

  constructor(model: T) {
    this.model = model;
  }

  static getRecursiveModelsMap() {
    const modelsMap = new Map<string, typeof Model>();

    if (!this._modelsRegistry) {
      return modelsMap;
    }

    this._modelsRegistry?.forEach(model => {
      modelsMap.set(model.slug, model);
    });

    const parent = Object.getPrototypeOf(this) as typeof Adapter;

    if (typeof parent.getRecursiveModelsMap === "function") {
      parent.getRecursiveModelsMap().forEach((model, slug) => {
        if (!modelsMap.has(slug)) {
          modelsMap.set(slug, model);
        }
      });
    }

    return modelsMap;
  }

  static getClosestModel(slug: string): typeof Model | undefined {
    if (this.hasModel(slug)) {
      return this._modelsRegistry?.get(slug);
    }

    const parent = Object.getPrototypeOf(this) as typeof Adapter;

    if (typeof parent.getClosestModel === "function") {
      return parent.getClosestModel(slug);
    }

    return;
  }

  static getModelsRegistry() {
    if (!this.hasOwnProperty("_modelsRegistry") || !this._modelsRegistry) {
      this._modelsRegistry = new Map();
    }

    return this._modelsRegistry;
  }

  static hasModel(slug: string) {
    return Boolean(this.getModelsRegistry().has(slug));
  }

  static registerModel(model: typeof Model, force = false) {
    if (!model.cacheAdapter) {
      return;
    }

    if (!force && this.hasModel(model.slug)) {
      throw new CoreError({
        message: `Model ${model.slug} already registered on adapter ${this.__name}`,
      });
    }

    this.getModelsRegistry().set(model.slug, model);
  }

  static clearModels() {
    this.getModelsRegistry().clear();
  }

  get cacheFieldsMap() {
    this.#cacheFieldsMap ??= new Map();
    return this.#cacheFieldsMap;
  }

  resetFieldsCache() {
    this.#cacheFieldsMap = new Map();
  }

  /**
   * Get the base adapter class to extend from.
   */
  get base() {
    return this.constructor as typeof Adapter;
  }
}
