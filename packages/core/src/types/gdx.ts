import { DataModel, InferModelDefInput, Model, Models } from "@/index.js";
import { TModelConfiguration } from "@/lib/model.js";

export type GDXEntryModelInput<T extends TModelConfiguration> =
  | (InferModelDefInput<typeof Model & { configuration: T }, "json"> &
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
  [K: string]: InferModelDefInput<typeof DataModel, "json">;
};

export type GDXType<D extends GDXDatamodels = {}> = {
  datamodels: D;
} & Omit<
  {
    [K in keyof D]?: D[K] extends InferModelDefInput<typeof DataModel, "json">
      ? GDXEntryModel<InferModelConfigurationFromDatamodel<D[K]>>
      : never;
  } & {
    [K in keyof Models]?: Models[K] extends { configuration: TModelConfiguration }
      ? GDXEntryModel<Models[K]["configuration"]>
      : never;
  },
  "datamodels"
>;

export type InferModelConfigurationFromDatamodel<D extends InferModelDefInput<typeof DataModel, "json">> = {
  slug: D["slug"];
  single: D["single"] extends true ? true : false;
  properties: D["properties"] extends Record<string, any> ? D["properties"] : undefined;
  validators: D["validators"] extends Array<any> ? D["validators"] : undefined;
  keyProperty: D["keyProperty"] extends string ? D["keyProperty"] : undefined;
  realtime: D["realtime"] extends true ? true : false;
  required: D["required"] extends string[] ? D["required"] : undefined;
};

// Extract the datamodels type from a GDX object
export type InferGDXDatamodels<T> = T extends GDXType<infer D> ? D : never;

export const defineDatamodels = <const D extends GDXDatamodels = {}>(datamodels: D) => datamodels;

export const defineGDX = <const D extends GDXDatamodels = {}>(gdx: GDXType<D>) => gdx;

// const gdx = defineGDX({
//   datamodels: {
//     test: {
//       slug: "test",
//       properties: {
//         name: { type: "text" },
//         age: { type: "number" },
//       },
//     },
//   },
//   test: {
//     test1: {
//       name: "test",
//     },
//     test2: {},
//   },
// });
