import { Command } from "commander";
import { colorizeJson, getClient, getTable } from "@/lib/utils.js";
import { DataModel, JSONObject, Adapter } from "@graphand/core";

export const commandModels = new Command("models")
  .description("Get a model description")
  .arguments("[modelName]")
  .action(async modelName => {
    const client = await getClient();

    if (!modelName) {
      const datamodels = await client.model(DataModel).getList();
      const coreModels = Array.from(Adapter.getModelsRegistry().keys());

      const slugs = Array.from(new Set(datamodels.map(model => model.slug).concat(coreModels))).filter(Boolean);
      const list = await Promise.all(slugs.map(slug => client.model(slug as string)));

      const table = getTable({
        properties: ["slug", "keyProperty"],
        list: list,
        getter: (item, property) => {
          if (property === "keyProperty") {
            return item.getKeyProperty();
          }

          return item[property as keyof typeof item];
        },
      });

      console.log(table);
      return;
    }

    const model = client.model(String(modelName));

    await model.initialize();

    console.log(colorizeJson(model.configuration as JSONObject));
  });
