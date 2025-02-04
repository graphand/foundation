import { Client, ClientOptions } from "@graphand/client";
import { Ora } from "ora";
import { Config } from "./lib/Config.js";
import { GDXDatamodels, GDXType, JSONPrimitive } from "@graphand/core";

declare global {
  export var client: Client | undefined;
  export var spinner: Ora | undefined;
  export var jobs: string[] | undefined;
  export var userConfig: Config | undefined;
}

export type UserConfig = {
  client: ClientOptions;
  gdx?: {
    path: string;
  };
};

export type GDXCli<D extends GDXDatamodels = GDXDatamodels> = {
  "$cli.set"?: Record<string, JSONPrimitive>;
  "$cli.file"?: Record<string, string>;
  "$cli.function"?: Record<string, string>;
} & GDXType<D>;
