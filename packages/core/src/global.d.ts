import { ModelJSON } from "@/types";
import Model from "./lib/Model";

declare global {
  // eslint-disable-next-line no-unused-vars
  type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
}
