import {
  DataModel,
  InferModelDef,
  InferModelDefInputWithoutKey,
  Model,
  ModelInstance,
  SerializerFormat,
  TModelConfiguration,
} from "../index.js";

export type InferModel<T extends ModelInstance<typeof Model>> =
  T extends ModelInstance<infer R extends typeof Model> ? R : typeof Model;

export type InferValue<T extends ModelInstance, P extends string, S extends SerializerFormat> =
  typeof Model extends InferModel<T>
    ? any
    : P extends keyof InferModelDef<InferModel<T>, S>
      ? InferModelDef<InferModel<T>, S>[P]
      : unknown;

export type InferModelConfigurationFromDatamodel<
  K,
  D extends InferModelDefInputWithoutKey<typeof DataModel, "json">,
> = {
  readonly slug: K extends string ? K : "";
  readonly keyProperty: D["keyProperty"] extends TModelConfiguration["keyProperty"] ? D["keyProperty"] : undefined;
  readonly single: D["single"] extends TModelConfiguration["single"] ? D["single"] : undefined;
  readonly properties: D["properties"] extends TModelConfiguration["properties"] ? D["properties"] : undefined;
  readonly validators: D["validators"] extends TModelConfiguration["validators"] ? D["validators"] : undefined;
  readonly realtime: D["realtime"] extends TModelConfiguration["realtime"] ? D["realtime"] : undefined;
  readonly required: D["required"] extends TModelConfiguration["required"] ? D["required"] : undefined;
  readonly noBulk: D["noBulk"] extends TModelConfiguration["noBulk"] ? D["noBulk"] : undefined;
};
