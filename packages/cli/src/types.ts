import { Client, ClientOptions } from "@graphand/client";
import { Ora } from "ora";

declare global {
  export var client: Client | undefined;
  export var spinner: Ora;
  export var jobs: string[] | undefined;
}

export type UserConfig = {
  client: ClientOptions;
};
