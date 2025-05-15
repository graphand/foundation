import { Module, symbolModuleInit, symbolModuleDestroy } from "@graphand/server";
import { RouteEntry } from "./routes/entry.js";

type ModuleExampleOptions = {
  foo?: string;
  bar?: number;
};

export class ModuleExample extends Module<ModuleExampleOptions> {
  static moduleName = "example" as const;
  defaults = {};

  async [symbolModuleInit]() {
    this.server.addRoute(new RouteEntry());
    console.log("ModuleExample init");
  }

  async [symbolModuleDestroy]() {
    console.log("ModuleExample destroy");
  }
}
