import { Module, symbolModuleInit } from "@graphand/client";

class ModuleRealtime extends Module<{}> {
  static moduleName = "realtime" as const;

  async [symbolModuleInit]() {
    console.log("ModuleRealtime init");
  }
}

export default ModuleRealtime;
