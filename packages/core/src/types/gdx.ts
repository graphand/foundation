import { DataModel, Model, ModelDefinition, ModelJSON, Models } from "@/index.js";

export type GDXEntryModelInput<T extends ModelDefinition> =
  | (ModelJSON<typeof Model & { definition: T }> &
      Partial<{
        $dependency: boolean;
        $force: boolean;
      }>)
  | "$delete"
  | "$ignore";

export type GDXEntryModel<T extends ModelJSON<typeof DataModel> | { definition: ModelDefinition }> =
  T["definition"] extends ModelDefinition
    ? T["definition"]["single"] extends true
      ? GDXEntryModelInput<T["definition"]>
      : Record<string, GDXEntryModelInput<T["definition"]>>
    : never;

export type GDXDatamodels = {
  [K: string]: ModelJSON<typeof DataModel>;
};

export type GDXType<D extends GDXDatamodels = {}> = {
  datamodels: D;
} & Omit<
  {
    [K in keyof D]?: D[K] extends ModelJSON<typeof DataModel> ? GDXEntryModel<D[K]> : never;
  } & {
    [K in keyof Models]?: GDXEntryModel<Models[K]>;
  },
  "datamodels"
>;

// Extract the datamodels type from a GDX object
export type InferGDXDatamodels<T> = T extends GDXType<infer D> ? D : never;

export const defineDatamodels = <D extends GDXDatamodels = {}>(datamodels: D) => datamodels;

export const defineGDX = <D extends GDXDatamodels = {}>(gdx: GDXType<D>) => gdx;
