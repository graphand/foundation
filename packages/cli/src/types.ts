import { Client, ClientOptions } from "@graphand/client";
import { Ora } from "ora";
import { Config } from "./lib/Config.js";
import { DataModel, GDXType, JSONPrimitive, ModelJSON } from "@graphand/core";

declare global {
  export var client: Client | undefined;
  export var spinner: Ora | undefined;
  export var jobs: string[] | undefined;
  export var userConfig: Config | undefined;
}

export type GDXDatamodels = {
  [slug: string]: ModelJSON<typeof DataModel>;
};

export type GDXCliType<D extends GDXDatamodels = GDXDatamodels> = {
  "$cli.set"?: Record<string, JSONPrimitive>;
  "$cli.file"?: Record<string, string>;
  "$cli.function"?: Record<string, string>;
} & Omit<GDXType<D>, "$cli.set" | "$cli.file" | "$cli.function">;

export type UserConfig<D extends GDXDatamodels = {}> = {
  client: ClientOptions<D>;
  gdx?:
    | {
        path: string;
      }
    | {
        data: GDXCliType<D>;
      };
};
