import { Command } from "commander";
import { getClient } from "@/lib/utils";
import ora from "ora";
import qs from "qs";
import { JSONQuery, ModelInstance } from "@graphand/core";
import chalk from "chalk";

export const commandDescribe = new Command("describe")
  .alias("read")
  .description("Get a model instance")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .action(async (modelName, key, options) => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    let instance: ModelInstance<typeof model>;

    await model.initialize();

    const spinner = ora(`Fetching ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"} ...`).start();

    try {
      if (key) {
        instance = await model.get(key);
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        instance = await model.get(query);
      }

      spinner.succeed(`Fetched ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"} successfully`);
    } catch (e) {
      spinner.fail(`Failed to fetch ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}`);
      console.log(JSON.stringify(e, null, 2));
      return;
    }

    if (!instance) {
      return;
    }

    let fields: Array<string> = options.fields?.split(",");

    if (!fields?.length) {
      fields = Array.from(new Set(["_id", model.getKeyField()]));
    }

    console.log("");
    console.log(JSON.stringify(instance.toJSON(), null, 2));
  });
