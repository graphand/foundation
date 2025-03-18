import { PropertyTypes } from "@/enums/property-types.js";
import { Model } from "@/lib/model.js";
import {
  ModelInstance,
  InferPropertyType,
  SerializerFormat,
  SerializerCtx,
  TransactionCtx,
  PropertySerializerInput,
  ModelData,
  PropertyDefinitionGeneric,
} from "@/types/index.js";

export class Property<T extends PropertyTypes = PropertyTypes> {
  static readonly defaultSymbol: unique symbol = Symbol("defaultSerializer");

  #definition: PropertyDefinitionGeneric<T>; // The property definition
  #path: string; // The path of the property in the model

  serializerMap: {
    [S in SerializerFormat]?: (
      _input: PropertySerializerInput<S>,
    ) => InferPropertyType<PropertyDefinitionGeneric<T>, S>;
  } & {
    [Property.defaultSymbol]?: (_input: PropertySerializerInput) => unknown;
  };

  constructor(definition: PropertyDefinitionGeneric<T>, path: string) {
    this.#definition = definition;
    this.#path = path;
    this.serializerMap ??= {};

    // TODO : remove this once we have a proper way to handle options
    if ("options" in this.#definition && this.#definition.options) {
      throw new Error("options is not allowed in property definition");
    }
  }

  get type(): T {
    return this.#definition.type as T;
  }

  get path() {
    return this.#path;
  }

  get definition(): PropertyDefinitionGeneric<T> {
    return this.#definition;
  }

  validate?: (_input: { list: Array<ModelInstance>; model: typeof Model; ctx?: TransactionCtx }) => Promise<boolean>;

  serialize = <S extends SerializerFormat>(opts: {
    value: unknown;
    format: S;
    from: ModelInstance;
    ctx: SerializerCtx;
    nextData?: ModelData;
  }): InferPropertyType<PropertyDefinitionGeneric<T>, S> => {
    const { value, format } = opts;
    const s = this.serializerMap?.[format] || this.serializerMap?.[Property.defaultSymbol];

    if (!s) {
      return value as InferPropertyType<PropertyDefinitionGeneric<T>, S>;
    }

    const serializer = s as (_input: PropertySerializerInput<S>) => InferPropertyType<PropertyDefinitionGeneric<T>, S>;

    return serializer(opts);
  };

  toJSON() {
    return {
      ...this.#definition,
      path: this.#path,
    };
  }

  static fromJSON(json: ReturnType<Property["toJSON"]>) {
    const { path, ...definition } = json;
    return new Property(definition, path);
  }
}
