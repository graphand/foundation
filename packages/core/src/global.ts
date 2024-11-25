import type { ModelJSON } from "@/types/index.js";
import type { Model } from "@/lib/Model.js";

declare global {
  export type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
  const __INTERNAL_CORE_VERSION__: string;
}
