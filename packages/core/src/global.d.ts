import type { Adapter, ModelJSON } from "./index.ts";

declare global {
  export type ModelData<M extends typeof Model = typeof Model> = ModelJSON<M>;
  var __GLOBAL_ADAPTER__: typeof Adapter | undefined;
}

export {};
