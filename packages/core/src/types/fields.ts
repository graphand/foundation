import { ValidatorDefinitionOmitField } from "@/types/validators.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Model } from "@/lib/Model.js";
import { PromiseModel } from "@/lib/PromiseModel.js";
import { PromiseModelList } from "@/lib/PromiseModelList.js";
import {
  JSONTypeObject,
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
    items: FieldDefinitions;
    validators?: Array<ValidatorDefinitionOmitField>;
    distinct?: boolean;
  };
  [FieldTypes.TEXT]: {
    default?: string;
    enum?: string[];
    strict?: boolean;
  };
  [FieldTypes.RELATION]: {
    ref: string;
  };
  [FieldTypes.NUMBER]: {
    default?: number;
  };
  [FieldTypes.INTEGER]: {
    default?: number;
  };
  [FieldTypes.OBJECT]: {
    default?: JSONTypeObject;
    defaultField?: FieldDefinitions;
    conditionalFields?: ConditionalFieldsDefinition;
    fields?: FieldsDefinition;
    strict?: boolean;
    validators?: ValidatorsDefinition;
  };
  [FieldTypes.BOOLEAN]: {
    default?: boolean;
  };
  [FieldTypes.ENUM]: {
    default?: string;
    enum: string[];
  };
};

export type FieldOptions<T extends FieldTypes = FieldTypes> = T extends keyof FieldOptionsMap
  ? FieldOptionsMap[T]
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
          (F["options"]["strict"] extends true ? {} : JSONTypeObject)
      : JSONTypeObject;
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
          (F["options"]["strict"] extends true ? {} : JSONTypeObject)
      : JSONTypeObject;
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

// type EnumLiteralType<T> = T extends { [k: string]: infer U } ? U : never;
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
    ? Partial<{
        [F in keyof R]: R[F] extends FieldDefinition<FieldTypes> ? InferFieldType<R[F], S> : never;
      }> &
        unknown
    : unknown
  : unknown) &
  Partial<{
    [F in keyof SystemFields<M>]: InferFieldType<SystemFields<M>[F], S>;
  }>;

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
