import type { GDXCliType, UserConfig } from "@/types.js";
import { GDXDatamodels } from "@graphand/core";
export * from "@/types.js";

export const defineConfig = <D extends GDXDatamodels>(config: UserConfig<D>): UserConfig<D> => config;

export const defineGDX = <D extends GDXDatamodels>(gdx: GDXCliType<D>): GDXCliType<D> => gdx;
