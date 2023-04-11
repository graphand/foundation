import { Model, defineFieldsProperties } from "@graphand/core";
import type ClientAdapter from "../lib/ClientAdapter";

Model.clearCache = function () {
  const adapter = this.__adapter as ClientAdapter;
  adapter.instancesMap.clear();
};

Model.hook("after", "initialize", async function () {
  const adapter = this.__adapter as ClientAdapter;
  adapter.instancesMap.forEach(defineFieldsProperties);
});
