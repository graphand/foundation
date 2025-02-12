import { ValidatorDefinitionOmitField } from "@/types/validators.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Model } from "@/lib/model.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import {
  JSONObject,
  ModelInstance,
  SerializerCtx,
  SerializerFormat,
  DecodeRefModel,
  ModelDefinition,
  FieldsDefinition,
  ValidatorsDefinition,
} from "../index.js";

export type ConditionalFieldsDefinition<Mappings extends Array<string> = Array<string>> = {
  dependsOn: string;
  mappings: Record<Mappings[number], Array<string>>;
  defaultMapping?: Mappings[number];
};

export type FieldOptionsMap = {
  [FieldTypes.ARRAY]: {
    items: Readonly<FieldDefinitions>;
    validators?: Readonly<Array<ValidatorDefinitionOmitField>>;
    distinct?: Readonly<boolean>;
  };
  [FieldTypes.TEXT]: {
    default?: Readonly<string>;
    enum?: Readonly<string[]>;
    strict?: Readonly<boolean>;
  };
  [FieldTypes.RELATION]: {
    ref: Readonly<string>;
  };
  [FieldTypes.NUMBER]: {
    default?: Readonly<number>;
  };
  [FieldTypes.INTEGER]: {
    default?: Readonly<number>;
  };
  [FieldTypes.OBJECT]: {
    default?: Readonly<JSONObject>;
    defaultField?: Readonly<FieldDefinitions>;
    conditionalFields?: Readonly<ConditionalFieldsDefinition>;
    fields?: Readonly<FieldsDefinition>;
    strict?: Readonly<boolean>;
    validators?: Readonly<ValidatorsDefinition>;
  };
  [FieldTypes.BOOLEAN]: {
    default?: Readonly<boolean>;
  };
  [FieldTypes.ENUM]: {
    default?: Readonly<string>;
    enum: Readonly<string[]>;
  };
};

export type FieldOptions<T extends FieldTypes = FieldTypes> = T extends keyof FieldOptionsMap
  ? Readonly<FieldOptionsMap[T]>
  : never;

export type FieldDefinitions = {
  [K in FieldTypes]: FieldDefinition<K>;
}[FieldTypes];

export type FieldDefinition<T extends FieldTypes = FieldTypes> = {
  type: T | `${T}`;
  options?: FieldOptions<T>;
  _ts?: any;
  _tsModel?: typeof Model;
};

export interface SystemFieldsBase {
  _id: { type: FieldTypes.ID };
  _createdAt: { type: FieldTypes.DATE };
  _createdBy: { type: FieldTypes.IDENTITY };
  _updatedAt: { type: FieldTypes.DATE };
  _updatedBy: { type: FieldTypes.IDENTITY };
}

export interface SystemFieldsOverrides<M extends typeof Model> {}

export type SystemFields<M extends typeof Model> = Omit<SystemFieldsBase, keyof SystemFieldsOverrides<M>> &
  SystemFieldsOverrides<M>;

export interface SerializerFieldsMap<F extends FieldDefinition = FieldDefinition> {
  json: {
    [FieldTypes.ID]: string;
    [FieldTypes.IDENTITY]: string;
    [FieldTypes.BOOLEAN]: boolean;
    [FieldTypes.NUMBER]: number;
    [FieldTypes.INTEGER]: number;
    [FieldTypes.DATE]: string;
    [FieldTypes.TEXT]: F["options"] extends FieldOptionsMap[FieldTypes.TEXT]
      ? F["options"]["enum"] extends Array<string>
        ? F["options"]["strict"] extends true
          ? F["options"]["enum"][number]
          : F["options"]["enum"][number] | string
        : string
      : string;
    [FieldTypes.ENUM]: F["options"] extends FieldOptionsMap[FieldTypes.ENUM] ? F["options"]["enum"][number] : never;
    [FieldTypes.OBJECT]: F["options"] extends FieldOptionsMap[FieldTypes.OBJECT]
      ? (F["options"]["fields"] extends FieldsDefinition
          ? Partial<{
              [K in keyof F["options"]["fields"]]: InferFieldType<F["options"]["fields"][K], "json">;
            }>
          : {}) &
          (F["options"]["defaultField"] extends FieldDefinition
            ? {
                [x: string]: InferFieldType<F["options"]["defaultField"], "json">;
              }
            : {}) &
          (F["options"]["strict"] extends true ? {} : JSONObject)
      : JSONObject;
    [FieldTypes.RELATION]: string;
    [FieldTypes.ARRAY]: F["options"] extends FieldOptionsMap[FieldTypes.ARRAY]
      ? Array<InferFieldType<F["options"]["items"], "json">>
      : Array<unknown>;
  };
  object: {
    [FieldTypes.ID]: string;
    [FieldTypes.IDENTITY]: string;
    [FieldTypes.BOOLEAN]: boolean;
    [FieldTypes.NUMBER]: number;
    [FieldTypes.INTEGER]: number;
    [FieldTypes.DATE]: Date;
    [FieldTypes.TEXT]: F["options"] extends FieldOptionsMap[FieldTypes.TEXT]
      ? F["options"]["enum"] extends Array<string>
        ? F["options"]["strict"] extends true
          ? F["options"]["enum"][number]
          : F["options"]["enum"][number] | string
        : string
      : string;
    [FieldTypes.ENUM]: F["options"] extends FieldOptionsMap[FieldTypes.ENUM] ? F["options"]["enum"][number] : never;
    [FieldTypes.OBJECT]: F["options"] extends FieldOptionsMap[FieldTypes.OBJECT]
      ? (F["options"]["fields"] extends FieldsDefinition
          ? Partial<{
              [K in keyof F["options"]["fields"]]: InferFieldType<F["options"]["fields"][K], "object">;
            }>
          : {}) &
          (F["options"]["defaultField"] extends FieldDefinition
            ? {
                [x: string]: InferFieldType<F["options"]["defaultField"], "object">;
              }
            : {}) &
          (F["options"]["strict"] extends true ? {} : JSONObject)
      : JSONObject;
    [FieldTypes.RELATION]: F["options"] extends FieldOptionsMap[FieldTypes.RELATION]
      ? F["options"]["ref"] extends string
        ? PromiseModel<F["_tsModel"] extends typeof Model ? F["_tsModel"] : DecodeRefModel<F["options"]["ref"]>>
        : PromiseModel<typeof Model>
      : PromiseModel<typeof Model>;
    [FieldTypes.ARRAY]: F["options"] extends FieldOptionsMap[FieldTypes.ARRAY]
      ? F["options"]["items"]["type"] extends FieldTypes.RELATION
        ? F["options"]["items"]["options"] extends FieldOptionsMap[FieldTypes.RELATION]
          ? PromiseModelList<DecodeRefModel<F["options"]["items"]["options"]["ref"]>>
          : PromiseModelList<typeof Model>
        : Array<InferFieldType<F["options"]["items"], "object">>
      : Array<unknown>;
  };
  validation: {};
}

type StringToFieldType<T extends string> = T extends `${infer U extends FieldTypes}` ? U : never;

export type InferFieldType<D extends FieldDefinition, F extends SerializerFormat> = "_ts" extends keyof D
  ? D["_ts"]
  : F extends keyof SerializerFieldsMap<D>
    ? D["type"] extends keyof SerializerFieldsMap<D>[F]
      ? SerializerFieldsMap<D>[F][D["type"]]
      : StringToFieldType<D["type"]> extends keyof SerializerFieldsMap<D>[F]
        ? SerializerFieldsMap<D>[F][StringToFieldType<D["type"]>]
        : `${D["type"]}` extends keyof SerializerFieldsMap<D>[F]
          ? SerializerFieldsMap<D>[F][`${D["type"]}`]
          : unknown
    : unknown;

export type InferModelDef<M extends typeof Model, S extends SerializerFormat = "object"> = (M extends {
  definition: { fields: infer R };
}
  ? R extends ModelDefinition["fields"]
    ? { [F in keyof R]?: R[F] extends FieldDefinition<FieldTypes> ? InferFieldType<R[F], S> : never }
    : never
  : unknown) & {
  [F in keyof SystemFields<M>]?: Readonly<InferFieldType<SystemFields<M>[F], S>>;
};

export type ModelObject<M extends typeof Model = typeof Model> = InferModelDef<M, "object">;

export type ModelJSON<M extends typeof Model = typeof Model> = InferModelDef<M, "json">;

export type ModelData<M extends typeof Model = typeof Model> = InferModelDef<M, "data">;

export type FieldSerializerInput<S extends SerializerFormat = SerializerFormat> = {
  value: unknown;
  from: ModelInstance;
  ctx: SerializerCtx;
  format: S;
  nextData?: ModelData;
};
