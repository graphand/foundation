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

type GDXFields = Partial<{
  $dependency: boolean;
  $force: boolean;
  $patch: boolean;
}>;

export type GDXEntryModelInput<T extends TModelConfiguration> =
  | (InferModelDefInputWithoutKey<typeof Model & { configuration: T }, "json"> & GDXFields)
  | "$delete"
  | "$ignore";

export type GDXEntryModel<T extends TModelConfiguration> = T["single"] extends true
  ? InferModelDefInput<typeof Model & { configuration: T }, "json"> & GDXFields
  : Record<string, GDXEntryModelInput<T>>;

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
