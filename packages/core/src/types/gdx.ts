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

export type GDXDatamodels = Record<string, ModelJSON<typeof DataModel>>;

export type GDXType<D extends Record<string, ModelJSON<typeof DataModel>>> = {
  datamodels?: D;
} & {
  [K in keyof D]?: GDXEntryModel<D[K]>;
} & {
  [K in keyof Models]?: GDXEntryModel<Models[K]>;
};

export const defineGDX = <D extends Record<string, ModelJSON<typeof DataModel>>>(gdx: GDXType<D>) => gdx;
