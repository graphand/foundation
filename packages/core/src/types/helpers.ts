import { Model, ModelInstance } from "../index.ts";

export type InferModel<T extends ModelInstance<typeof Model>> = T extends ModelInstance<infer M> ? M : typeof Model;
