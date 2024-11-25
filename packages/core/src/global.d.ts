import type { ModelJSON } from "./index.ts";

declare global {
  export type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
}
