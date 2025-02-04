import type { GDXCli, UserConfig } from "@/types.js";
import { GDXDatamodels } from "@graphand/core";
export * from "@/types.js";

export const defineConfig = <T extends UserConfig>(config: T): T => config;

export const defineGDX = <D extends GDXDatamodels>(gdx: GDXCli<D>): GDXCli<D> => gdx;
