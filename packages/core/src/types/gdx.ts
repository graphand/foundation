import { DataModel, Model, ModelJSON, Models } from "@/index.js";
import { TModelConfiguration } from "@/lib/model.js";

export type GDXEntryModelInput<T extends TModelConfiguration> =
  | (ModelJSON<typeof Model & { configuration: T }> &
      Partial<{
        $dependency: boolean;
        $force: boolean;
      }>)
  | "$delete"
  | "$ignore";

export type GDXEntryModel<T extends TModelConfiguration> = T["single"] extends true
  ? GDXEntryModelInput<T>
  : Record<string, GDXEntryModelInput<T>>;

export type GDXDatamodels = {
  [K: string]: ModelJSON<typeof DataModel>;
};

export type GDXType<D extends GDXDatamodels = {}> = {
  datamodels: D;
} & Omit<
  {
    [K in keyof D]?: D[K] extends ModelJSON<typeof DataModel>
      ? GDXEntryModel<{
          slug: D[K]["slug"];
          single: D[K]["single"];
        }>
      : never;
  } & {
    [K in keyof Models]?: Models[K] extends { configuration: TModelConfiguration }
      ? GDXEntryModel<Models[K]["configuration"]>
      : never;
  },
  "datamodels"
>;

// Extract the datamodels type from a GDX object
export type InferGDXDatamodels<T> = T extends GDXType<infer D> ? D : never;

export const defineDatamodels = <const D extends GDXDatamodels = {}>(datamodels: D) => datamodels;

export const defineGDX = <const D extends GDXDatamodels = {}>(gdx: GDXType<D>) => gdx;
