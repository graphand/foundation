import { Client, ClientOptions } from "@graphand/client";
import { Ora } from "ora";
import { Config } from "./lib/Config.js";
import { GDXDatamodels, GDXType } from "@graphand/core";

declare global {
  export var client: Client | undefined;
  export var spinner: Ora | undefined;
  export var jobs: string[] | undefined;
  export var userConfig: Config | undefined;
}

export type UserConfig<D extends GDXDatamodels = {}> = {
  client: ClientOptions<D>;
  gdx?: { path: string } | { data: GDXType<D> };
};
