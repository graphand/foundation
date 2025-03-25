import {
  DataModel,
  InferModelConfigurationFromDatamodel,
  InferModelDefInput,
  InferModelDefInputWithoutKey,
  JSONObject,
  Model,
  Models,
  TModelConfiguration,
} from "@/index.js";

export type GDXEntryModelInput<T extends TModelConfiguration> =
  | (InferModelDefInputWithoutKey<typeof Model & { configuration: T }, "json"> &
      Partial<{
        $dependency: boolean;
        $force: boolean;
      }>)
  | "$delete"
  | "$ignore";

export type GDXEntryModel<T extends TModelConfiguration> = T["single"] extends true
  ? InferModelDefInput<typeof Model & { configuration: T }, "json">
  : Record<string, InferModelDefInputWithoutKey<typeof Model & { configuration: T }, "json">>;

export type GDXDatamodels = Record<string, InferModelDefInputWithoutKey<typeof DataModel, "json">>;

export type GDXTypeModels = {
  [K in keyof Models]?: Models[K] extends { configuration: infer C extends TModelConfiguration }
    ? GDXEntryModel<C>
    : never;
};

export type GDXType<D extends GDXDatamodels = GDXDatamodels> = { datamodels: D } & {
  [K in keyof D]?: GDXEntryModel<InferModelConfigurationFromDatamodel<K, D[K]>>;
} & GDXTypeModels &
  Omit<Record<string, JSONObject>, keyof D | keyof Models>;

// Extract the datamodels type from a GDX object
export type InferGDXDatamodels<T> = T extends GDXType<infer D> ? D : never;
