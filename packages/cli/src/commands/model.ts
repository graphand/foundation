import { Command } from "commander";
import { colorizeJson, getClient } from "@/lib/utils";
import { JSONTypeObject } from "@graphand/core";

export const commandModel = new Command("model")
  .description("Get a model description")
  .arguments("<modelName>")
  .action(async modelName => {
    const client = await getClient();
    const model = client.getModel(String(modelName));

    await model.initialize();

    console.log(colorizeJson(model.definition as JSONTypeObject));
  });
