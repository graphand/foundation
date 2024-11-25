import { FieldTypes } from "@/enums/field-types.js";
import { Model } from "@/lib/Model.js";
import {
  FieldDefinition,
  FieldOptions,
  ModelInstance,
  InferFieldType,
  SerializerFormat,
  SerializerCtx,
  TransactionCtx,
  SerializerFieldsMap,
  FieldSerializerInput,
  ModelData,
} from "@/types/index.js";

export class Field<T extends FieldTypes = FieldTypes> {
  static readonly defaultSymbol: unique symbol = Symbol("defaultSerializer");

  #definition: FieldDefinition<T>; // The field definition
  #path: string; // The path of the field in the model

  serializerMap: Partial<{
    [S in SerializerFormat]: (_input: FieldSerializerInput<S>) => InferFieldType<FieldDefinition<T>, S>;
  }> & {
    [Field.defaultSymbol]?: (
      _input: FieldSerializerInput,
    ) => T extends keyof SerializerFieldsMap<FieldDefinition<T>>[keyof SerializerFieldsMap<FieldDefinition<T>>]
      ? SerializerFieldsMap<FieldDefinition<T>>[keyof SerializerFieldsMap<FieldDefinition<T>>][T]
      : unknown;
  };

  constructor(definition: FieldDefinition<T>, path: string) {
    this.#definition = definition;
    this.#path = path;
    this.serializerMap ??= {};
  }

  get type() {
    return this.#definition.type;
  }

  get path() {
    return this.#path;
  }

  get definition() {
    return this.#definition;
  }

  get options(): FieldOptions<T> {
    return (this.#definition.options ?? {}) as FieldOptions<T>;
  }

  validate?: (_input: { list: Array<ModelInstance>; model: typeof Model; ctx?: TransactionCtx }) => Promise<boolean>;

  serialize = <S extends SerializerFormat>(opts: {
    value: unknown;
    format: S;
    from: ModelInstance;
    ctx: SerializerCtx;
    nextData?: ModelData;
  }): InferFieldType<FieldDefinition<T>, S> => {
    const { value, format } = opts;
    const s = this.serializerMap?.[format] || this.serializerMap?.[Field.defaultSymbol];

    if (!s) {
      return value;
    }

    const serializer = s as (_input: FieldSerializerInput<S>) => InferFieldType<FieldDefinition<T>, S>;

    return serializer(opts);
  };

  toJSON() {
    return {
      type: this.type,
      options: this.options,
      path: this.#path,
    };
  }

  static fromJSON(json: ReturnType<Field["toJSON"]>) {
    const { type, options, path } = json;
    return new Field({ type, options }, path);
  }
}
