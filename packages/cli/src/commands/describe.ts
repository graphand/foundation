import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import qs from "qs";
import { JSONQuery, ModelInstance } from "@graphand/core";
import chalk from "chalk";

export const commandDescribe = new Command("describe")
  .alias("read")
  .description("Get a model instance")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .action(async (modelName, key, options) => {
    await withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));
      let instance: ModelInstance<typeof model>;

      await model.initialize();

      spinner.text = `Fetching ${chalk.cyan(model.slug)} ${key ? `with key ${chalk.bold(key)}` : "list"} ...`;

      if (key) {
        instance = await model.get(key);
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        instance = await model.get(query);
      }

      spinner.succeed(`Fetched ${chalk.bold(model.slug)} ${key ? `with key ${chalk.bold(key)}` : "list"} successfully`);

      if (!instance) {
        return;
      }

      let fields: Array<string> = options.fields?.split(",");

      if (!fields?.length) {
        fields = Array.from(new Set(["_id", model.getKeyField()]));
      }

      return instance.toJSON();
    });
  });
