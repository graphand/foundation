import { ModelJSON } from "@/types/index.ts";
import Model from "./lib/Model.ts";

declare global {
  // eslint-disable-next-line no-unused-vars
  type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
}
