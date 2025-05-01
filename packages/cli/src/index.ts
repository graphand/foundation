import type { UserConfig } from "@/types.js";
import { GDXDatamodels } from "@graphand/core";
export * from "@/types.js";

export const defineConfig = <D extends GDXDatamodels>(config: UserConfig<D>): UserConfig<D> => config;
