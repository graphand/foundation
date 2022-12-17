import { Model } from "@graphand/core";
import ClientModelAdapter from "./lib/ClientModelAdapter";

export const getClientFromModel = (model: typeof Model) => {
  const adapter = model.getAdapter() as ClientModelAdapter;

  if (!adapter.client) {
    throw new Error("MODEL_NO_CLIENT");
  }

  return adapter.client;
};
