import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import qs from "qs";
import { JSONQuery } from "@graphand/core";

export const commandDelete = new Command("delete")
  .description("Delete an instance")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .option("-f --fields <fields>", "Fields to display (comma separated)")
  .option("-o --output <output>", "Output format (json, table)")
  .option("-1", "Sort by -_id")
  .option("--last", "Get the last created item")
  .action(async (modelName, key, options) => {
    await withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));
      let deleted: Array<string> = [];

      spinner.text = `Initializing model ${model.slug} ...`;

      await model.initialize();

      spinner.text = `Deleting ${model.slug} ${key ? `with key ${key}` : "list"} ...`;

      const start = Date.now();

      if (key) {
        deleted = await model.delete(key);
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        if (options.last) {
          query.limit = 1;
          query.sort = { _id: -1 };
        } else {
          query.limit = Number(query.limit) || undefined;
          query.pageSize = Number(query.pageSize) || undefined;
          query.sort ??= options["1"] ? { _id: -1 } : undefined;
        }

        deleted = await model.delete(query);
      }

      const end = Date.now();

      spinner.succeed(
        `Deleted ${model.slug} ${key ? `with key ${key}` : "list"}: ${deleted.length} result${
          deleted.length > 1 ? "s" : ""
        } processed in ${end - start}ms`,
      );
    });
  });
