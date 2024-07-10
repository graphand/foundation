import { Model, ModelInstance } from "..";

export type InferModel<T extends ModelInstance<typeof Model>> = T extends ModelInstance<infer M>
  ? M
  : typeof Model;
