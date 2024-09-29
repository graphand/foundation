import { Client, ClientOptions } from "@graphand/client";
import { Ora } from "ora";

declare global {
  export var client: Client;
  export var spinner: Ora;
  export var jobs: string[] | undefined;
  export var userConfig: UserConfig | undefined;
}

export type UserConfig = {
  client: ClientOptions;
  gdx?: {
    path: string;
  };
};
