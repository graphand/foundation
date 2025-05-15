import { ModuleConstructor, ModuleWithConfig } from "@/types.js";
import { Model } from "@graphand/core";
import { ServerAdapter } from "./adapter.js";

export const decodeServerModule = <T extends ModuleConstructor>(
  module: ModuleWithConfig<T>,
): {
  moduleClass: T;
  conf: ModuleWithConfig<T>[1];
} => {
  let moduleClass: T | undefined;
  let conf: ModuleWithConfig<T>[1];

  if (Array.isArray(module)) {
    moduleClass = module[0];
    conf = module[1];
  }

  if (!moduleClass) {
    throw new Error("Module class not found");
  }

  return { moduleClass, conf: conf || {} };
};

export const getRequestHelper = (model: typeof Model) => {
  const adapter = model.getAdapter() as ServerAdapter;
  return adapter.getRequestHelper();
};
