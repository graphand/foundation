import { DataModel, InferModelDefInput, Model, Models, SerializerFormat, TModelConfiguration } from "@/index.js";

export type InferModelDefInputWithoutKey<
  T extends typeof Model,
  S extends SerializerFormat,
> = T extends typeof Model & { configuration: infer C extends TModelConfiguration }
  ? InferModelDefInput<T, S, C["keyProperty"] extends string ? C["keyProperty"] : never>
  : never;

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

export type GDXType<D extends GDXDatamodels = GDXDatamodels> = GDXTypeModels & { datamodels: D } & {
  [K in keyof D]?: GDXEntryModel<InferModelConfigurationFromDatamodel<K, D[K]>>;
};

export type InferModelConfigurationFromDatamodel<
  K,
  D extends InferModelDefInputWithoutKey<typeof DataModel, "json">,
> = Readonly<{
  readonly slug: K extends TModelConfiguration["slug"] ? K : never;
  readonly keyProperty: D["keyProperty"] extends TModelConfiguration["keyProperty"] ? D["keyProperty"] : undefined;
  readonly single: D["single"] extends TModelConfiguration["single"] ? D["single"] : undefined;
  readonly properties: D["properties"] extends TModelConfiguration["properties"] ? D["properties"] : undefined;
  readonly validators: D["validators"] extends TModelConfiguration["validators"] ? D["validators"] : undefined;
  readonly realtime: D["realtime"] extends TModelConfiguration["realtime"] ? D["realtime"] : undefined;
  readonly required: D["required"] extends TModelConfiguration["required"] ? D["required"] : undefined;
}>;

// Extract the datamodels type from a GDX object
export type InferGDXDatamodels<T> = T extends GDXType<infer D> ? D : never;
