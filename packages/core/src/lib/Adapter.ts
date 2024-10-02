import { AdapterFetcher } from "@/types/index.js";
import { Model } from "@/lib/Model.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Field } from "@/lib/Field.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/Validator.js";
import { CoreError } from "./CoreError.js";
import { FieldId } from "./fields/Id.js";
import { FieldNumber } from "./fields/Number.js";
import { FieldBoolean } from "./fields/Boolean.js";
import { FieldDate } from "./fields/Date.js";
import { FieldText } from "./fields/Text.js";
import { FieldRelation } from "./fields/Relation.js";
import { FieldNested } from "./fields/Nested.js";
import { FieldIdentity } from "./fields/Identity.js";
import { FieldArray } from "./fields/Array.js";
import { ValidatorUnique } from "./validators/Unique.js";
import { ValidatorRegex } from "./validators/Regex.js";
import { ValidatorKeyField } from "./validators/KeyField.js";
import { ValidatorDatamodelSlug } from "./validators/DatamodelSlug.js";
import { ValidatorDatamodelDefinition } from "./validators/DatamodelDefinition.js";
import { ValidatorLength } from "./validators/Length.js";
import { ValidatorBoundaries } from "./validators/Boundaries.js";
import { ValidatorRequired } from "./validators/Required.js";

export class Adapter<T extends typeof Model = typeof Model> {
  static __name = "Adapter";

  static fieldsMap: { [T in FieldTypes]?: typeof Field<T> } = {
    [FieldTypes.ID]: FieldId,
    [FieldTypes.NUMBER]: FieldNumber,
    [FieldTypes.BOOLEAN]: FieldBoolean,
    [FieldTypes.DATE]: FieldDate,
    [FieldTypes.TEXT]: FieldText,
    [FieldTypes.RELATION]: FieldRelation,
    [FieldTypes.NESTED]: FieldNested,
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

    // @ts-expect-error __proto__
    const parent = this.__proto__ as typeof Adapter;

    if (parent?._modelsRegistry) {
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

    // @ts-expect-error __proto__
    const parent = this.__proto__ as typeof Adapter;

    if (!parent?._modelsRegistry) {
      return;
    }

    return parent.getClosestModel(slug);
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
