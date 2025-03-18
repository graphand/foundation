import { DataModel, InferModelDefInput, Model, Models, SerializerFormat, TModelConfiguration } from "@/index.js";

type InferModelDefInputWithoutKey<T extends typeof Model, S extends SerializerFormat> = T extends {
  configuration: { keyProperty: infer K };
}
  ? K extends string
    ? Omit<InferModelDefInput<T, S>, K>
    : InferModelDefInput<T, S>
  : InferModelDefInput<T, S>;

export type GDXEntryModelInput<T extends TModelConfiguration> =
  | (InferModelDefInputWithoutKey<typeof Model & { configuration: T }, "json"> &
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
  [K: string]: InferModelDefInputWithoutKey<typeof DataModel, "json">;
};

export type GDXType<D extends GDXDatamodels = {}> = {
  datamodels: D;
} & Omit<
  {
    [K in keyof D]?: D[K]["keyProperty"] extends string
      ? D[K] extends InferModelDefInputWithoutKey<typeof DataModel, "json">
        ? GDXEntryModel<InferModelConfigurationFromDatamodel<K, D[K]>>
        : never
      : never;
  } & {
    [K in keyof Models]?: Models[K] extends { configuration: infer C extends TModelConfiguration }
      ? C["keyProperty"] extends string
        ? GDXEntryModel<C>
        : never
      : never;
  },
  "datamodels"
>;

export type InferModelConfigurationFromDatamodel<
  K,
  D extends InferModelDefInputWithoutKey<typeof DataModel, "json">,
> = {
  slug: K extends string ? K : never;
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
//       keyProperty: "name",
//       properties: {
//         name: { type: "string" },
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
