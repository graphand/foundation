import { AdapterFetcher, SerializerFormat } from "@/types/index.js";
import { Model } from "@/lib/model.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Property } from "@/lib/property.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { CoreError } from "./core-error.js";
import { PropertyId } from "./properties/id.js";
import { PropertyNumber } from "./properties/number.js";
import { PropertyBoolean } from "./properties/boolean.js";
import { PropertyDate } from "./properties/date.js";
import { PropertyString } from "./properties/string.js";
import { PropertyRelation } from "./properties/relation.js";
import { PropertyObject } from "./properties/object.js";
import { PropertyIdentity } from "./properties/identity.js";
import { PropertyArray } from "./properties/array.js";
import { ValidatorUnique } from "./validators/unique.js";
import { ValidatorRegex } from "./validators/regex.js";
import { ValidatorKeyProperty } from "./validators/key-property.js";
import { ValidatorDatamodel } from "./validators/datamodel.js";
import { ValidatorLength } from "./validators/length.js";
import { ValidatorBoundaries } from "./validators/boundaries.js";
import { ValidatorRequired } from "./validators/required.js";
import { PropertyInteger } from "./properties/integer.js";
import { PropertyNull } from "./properties/null.js";

export class Adapter<T extends typeof Model = typeof Model> {
  static __name = "Adapter";

  static propertiesMap: Partial<{ [T in PropertyTypes]: typeof Property<T> }> = {
    [PropertyTypes.ID]: PropertyId,
    [PropertyTypes.NUMBER]: PropertyNumber,
    [PropertyTypes.INTEGER]: PropertyInteger,
    [PropertyTypes.BOOLEAN]: PropertyBoolean,
    [PropertyTypes.DATE]: PropertyDate,
    [PropertyTypes.STRING]: PropertyString,
    [PropertyTypes.RELATION]: PropertyRelation,
    [PropertyTypes.OBJECT]: PropertyObject,
    [PropertyTypes.IDENTITY]: PropertyIdentity,
    [PropertyTypes.ARRAY]: PropertyArray,
    [PropertyTypes.NULL]: PropertyNull,
  };
  static validatorsMap: Partial<{ [T in ValidatorTypes]: typeof Validator<T> }> = {
    [ValidatorTypes.REQUIRED]: ValidatorRequired,
    [ValidatorTypes.UNIQUE]: ValidatorUnique,
    [ValidatorTypes.REGEX]: ValidatorRegex,
    [ValidatorTypes.KEY_PROPERTY]: ValidatorKeyProperty,
    [ValidatorTypes.DATAMODEL]: ValidatorDatamodel,
    [ValidatorTypes.LENGTH]: ValidatorLength,
    [ValidatorTypes.BOUNDARIES]: ValidatorBoundaries,
  };

  static dataFormat: SerializerFormat = "data";
  static runWriteValidators: boolean; // If the adapter should run validators after a model create/update

  static _modelsRegistry: Map<string, typeof Model>;

  fetcher?: AdapterFetcher<T>; // The adapter configuration = how the adapter should process
  model: T; // The model of the current adapter instance

  #cachePropertiesMap: Map<string, Property<PropertyTypes>> | undefined; // Cache the properties of the current model

  constructor(model: T) {
    this.model = model;
  }

  static getRecursiveModelsMap() {
    const modelsMap = new Map<string, typeof Model>();

    if (!this._modelsRegistry) {
      return modelsMap;
    }

    this._modelsRegistry?.forEach(model => {
      modelsMap.set(model.configuration.slug, model);
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
    const slug = model.configuration.slug;
    if (!force && this.hasModel(slug)) {
      throw new CoreError({
        message: `Model ${slug} already registered on adapter ${this.__name}`,
      });
    }

    this.getModelsRegistry().set(slug, model);
  }

  static clearModels() {
    this.getModelsRegistry().clear();
  }

  get cachePropertiesMap() {
    this.#cachePropertiesMap ??= new Map();
    return this.#cachePropertiesMap;
  }

  resetPropertiesCache() {
    this.#cachePropertiesMap = new Map();
  }

  /**
   * Get the base adapter class to extend from.
   */
  get base() {
    return this.constructor as typeof Adapter;
  }
}
