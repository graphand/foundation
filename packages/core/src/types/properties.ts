import { ValidatorDefinitionOmitProperty } from "@/types/validators.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Model } from "@/lib/model.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import {
  JSONObject,
  ModelInstance,
  SerializerCtx,
  SerializerFormat,
  DecodeRefModel,
  PropertiesDefinition,
  ValidatorsDefinition,
} from "../index.js";

export type ConditionalPropertiesDefinition<Mappings extends Array<string> = Array<string>> = {
  dependsOn: string;
  mappings: Record<Mappings[number], Array<string>>;
  defaultMapping?: Mappings[number];
};

export type PropertyOptionsMap = {
  [PropertyTypes.ARRAY]: {
    default?: Readonly<Array<unknown>>;
    items: Readonly<PropertyDefinitions>;
    validators?: Readonly<Array<ValidatorDefinitionOmitProperty>>;
    distinct?: Readonly<boolean>;
  };
  [PropertyTypes.TEXT]: {
    default?: Readonly<string>;
  };
  [PropertyTypes.RELATION]: {
    ref: string;
  };
  [PropertyTypes.NUMBER]: {
    default?: Readonly<number>;
  };
  [PropertyTypes.INTEGER]: {
    default?: Readonly<number>;
  };
  [PropertyTypes.OBJECT]: {
    default?: Readonly<JSONObject>;
    additionalProperties?: Readonly<PropertyDefinitions>;
    conditionalProperties?: Readonly<ConditionalPropertiesDefinition>;
    properties?: Readonly<PropertiesDefinition>;
    strict?: Readonly<boolean>;
    validators?: Readonly<ValidatorsDefinition>;
    required?: Readonly<string[]>;
  };
  [PropertyTypes.BOOLEAN]: {
    default?: Readonly<boolean>;
  };
  [PropertyTypes.ENUM]: {
    default?: Readonly<string>;
    enum: Array<string>;
  };
  [PropertyTypes.DEFAULT]: never;
  [PropertyTypes.ID]: never;
  [PropertyTypes.DATE]: never;
  [PropertyTypes.IDENTITY]: never;
};

export type PropertyOptions<T extends PropertyTypes = PropertyTypes> = Readonly<PropertyOptionsMap[T]>;

export type PropertyDefinitions = {
  [K in PropertyTypes]: PropertyDefinitionGeneric<K>;
}[PropertyTypes];

export type PropertyDefinitionGeneric<T extends PropertyTypes> = {
  type: T | `${T}`;
  options?: PropertyOptionsMap[T];
  required?: true;
};

export type PropertyDefinition = {
  [K in PropertyTypes]: PropertyDefinitionGeneric<K>;
}[PropertyTypes];

export interface SystemPropertiesBase {
  _id: { type: PropertyTypes.ID };
  _createdAt: { type: PropertyTypes.DATE };
  _createdBy: { type: PropertyTypes.IDENTITY };
  _updatedAt: { type: PropertyTypes.DATE };
  _updatedBy: { type: PropertyTypes.IDENTITY };
}

export interface SystemPropertiesOverrides<M extends typeof Model> {}

export type SystemProperties<M extends typeof Model> = Omit<SystemPropertiesBase, keyof SystemPropertiesOverrides<M>> &
  SystemPropertiesOverrides<M>;

export type InferPropertiesDefinition<F extends PropertiesDefinition, S extends SerializerFormat> = {
  [K in keyof F as F[K]["required"] extends true ? K : never]: InferPropertyType<F[K], S>;
} & {
  [K in keyof F as F[K]["required"] extends true ? never : K]?: InferPropertyType<F[K], S> | null | undefined;
};

// Helper types to handle additionalProperties properly
type WithDefaultProperty<Properties extends object, DefaultPropertyType> = Properties &
  Record<string, DefaultPropertyType | Properties[keyof Properties]>;

type SerializerJSON<F extends PropertyDefinitionGeneric<PropertyTypes>> = {
  [PropertyTypes.ID]: string;
  [PropertyTypes.IDENTITY]: string;
  [PropertyTypes.BOOLEAN]: boolean;
  [PropertyTypes.NUMBER]: number;
  [PropertyTypes.INTEGER]: number;
  [PropertyTypes.DATE]: string;
  [PropertyTypes.TEXT]: string;
  [PropertyTypes.ENUM]: F["options"] extends PropertyOptionsMap[PropertyTypes.ENUM]
    ? F["options"]["enum"][number] | `${F["options"]["enum"][number]}`
    : never;
  [PropertyTypes.OBJECT]: F["options"] extends PropertyOptionsMap[PropertyTypes.OBJECT]
    ? (F["options"]["properties"] extends PropertiesDefinition
        ? F["options"]["additionalProperties"] extends PropertyDefinition
          ? WithDefaultProperty<
              InferPropertiesDefinition<F["options"]["properties"], "json">,
              InferPropertyType<F["options"]["additionalProperties"], "json">
            >
          : InferPropertiesDefinition<F["options"]["properties"], "json">
        : F["options"]["additionalProperties"] extends PropertyDefinition
          ? Record<string, InferPropertyType<F["options"]["additionalProperties"], "json">>
          : {}) &
        (F["options"]["strict"] extends true ? {} : JSONObject)
    : JSONObject;
  [PropertyTypes.RELATION]: string;
  [PropertyTypes.ARRAY]: F["options"] extends PropertyOptionsMap[PropertyTypes.ARRAY]
    ? Array<InferPropertyType<F["options"]["items"], "json">>
    : Array<unknown>;
};

type SerializerObject<F extends PropertyDefinitionGeneric<PropertyTypes>> = {
  [PropertyTypes.ID]: string;
  [PropertyTypes.IDENTITY]: string;
  [PropertyTypes.BOOLEAN]: boolean;
  [PropertyTypes.NUMBER]: number;
  [PropertyTypes.INTEGER]: number;
  [PropertyTypes.DATE]: Date;
  [PropertyTypes.TEXT]: string;
  [PropertyTypes.ENUM]: F["options"] extends PropertyOptionsMap[PropertyTypes.ENUM]
    ? F["options"]["enum"][number]
    : never;
  [PropertyTypes.OBJECT]: F["options"] extends PropertyOptionsMap[PropertyTypes.OBJECT]
    ? (F["options"]["properties"] extends PropertiesDefinition
        ? F["options"]["additionalProperties"] extends PropertyDefinition
          ? WithDefaultProperty<
              InferPropertiesDefinition<F["options"]["properties"], "object">,
              InferPropertyType<F["options"]["additionalProperties"], "object">
            >
          : InferPropertiesDefinition<F["options"]["properties"], "object">
        : F["options"]["additionalProperties"] extends PropertyDefinition
          ? Record<string, InferPropertyType<F["options"]["additionalProperties"], "object">>
          : {}) &
        (F["options"]["strict"] extends true ? {} : JSONObject)
    : JSONObject;
  [PropertyTypes.RELATION]: F["options"] extends PropertyOptionsMap[PropertyTypes.RELATION]
    ? F["options"]["ref"] extends string
      ? PromiseModel<DecodeRefModel<F["options"]["ref"]>>
      : PromiseModel<typeof Model>
    : PromiseModel<typeof Model>;
  [PropertyTypes.ARRAY]: F["options"] extends PropertyOptionsMap[PropertyTypes.ARRAY]
    ? F["options"]["items"]["type"] extends PropertyTypes.RELATION
      ? F["options"]["items"]["options"] extends PropertyOptionsMap[PropertyTypes.RELATION]
        ? PromiseModelList<DecodeRefModel<F["options"]["items"]["options"]["ref"]>>
        : PromiseModelList<typeof Model>
      : Array<InferPropertyType<F["options"]["items"], "object">>
    : Array<unknown>;
};

export interface SerializerPropertiesMap<
  F extends PropertyDefinitionGeneric<PropertyTypes> = PropertyDefinitionGeneric<PropertyTypes>,
> {
  json: SerializerJSON<F>;
  object: SerializerObject<F>;
}

type StringToPropertyType<T extends string> = T extends `${infer U extends PropertyTypes}` ? U : never;

export type InferSystemProperties<M extends typeof Model, S extends SerializerFormat = "object"> = {
  [K in keyof SystemProperties<M>]: InferPropertyType<SystemProperties<M>[K], S>;
};

export type InferModelDef<M extends typeof Model, S extends SerializerFormat = "object"> = (M extends {
  configuration: { properties: infer R };
}
  ? R extends PropertiesDefinition
    ? InferPropertiesDefinition<R, S>
    : unknown
  : unknown) &
  InferSystemProperties<M, S>;

export type InferModelDefInput<M extends typeof Model, S extends SerializerFormat = "object"> = {
  [K in keyof InferModelDef<M, S> as K extends `_${string}` ? never : K]: InferModelDef<M, S>[K];
};

export type InferPropertyType<
  D extends PropertyDefinitionGeneric<PropertyTypes>,
  F extends SerializerFormat,
> = F extends keyof SerializerPropertiesMap<D> ? InferPropertyTypeByMapping<D, SerializerPropertiesMap<D>[F]> : unknown;

type InferPropertyTypeByMapping<D extends PropertyDefinitionGeneric<PropertyTypes>, Mapping> =
  // First, try to use the type directly.
  D["type"] extends keyof Mapping
    ? Mapping[D["type"]]
    : // If that fails, try to convert the type with StringToPropertyType.
      StringToPropertyType<D["type"]> extends keyof Mapping
      ? Mapping[StringToPropertyType<D["type"]>]
      : // Finally, try using a template literal version of the type.
        `${D["type"]}` extends keyof Mapping
        ? Mapping[`${D["type"]}`]
        : unknown;

export type ModelObject<M extends typeof Model = typeof Model> = InferModelDef<M, "object">;

export type ModelJSON<M extends typeof Model = typeof Model> = InferModelDef<M, "json">;

export type ModelData<M extends typeof Model = typeof Model> = InferModelDef<M, "data">;

export type PropertySerializerInput<S extends SerializerFormat = SerializerFormat> = {
  value: unknown;
  from: ModelInstance;
  ctx: SerializerCtx;
  format: S;
  nextData?: ModelData;
};
