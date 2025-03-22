import { InferModelDef, Model, ModelInstance, SerializerFormat } from "../index.js";

export type InferModel<T extends ModelInstance<typeof Model>> =
  T extends ModelInstance<infer R extends typeof Model> ? R : typeof Model;

export type InferValue<T extends ModelInstance, P extends string, S extends SerializerFormat> =
  typeof Model extends InferModel<T>
    ? any
    : P extends keyof InferModelDef<InferModel<T>, S>
      ? InferModelDef<InferModel<T>, S>[P]
      : unknown;
