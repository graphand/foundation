import { ModelJSON } from "@/types/index.js";
import Model from "./lib/Model.js";

declare global {
  // eslint-disable-next-line no-unused-vars
  type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
  const __INTERNAL_CORE_VERSION__: string;
}
