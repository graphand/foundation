import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import qs from "qs";
import { JSONQuery } from "@graphand/core";

export const commandCount = new Command("count")
  .description("Count a model")
  .arguments("<modelName>]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .action(async (modelName, options) => {
    await withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));

      console.info(`Initializing model ${model.slug} ...`);

      await model.initialize();

      console.info(`Counting ${model.slug} ...`);

      // const start = Date.now();

      let count: number;

      const query: JSONQuery = options.query ? qs.parse(options.query) : {};
      query.limit = Number(query.limit) || undefined;
      query.pageSize = Number(query.pageSize) || undefined;
      count = await model.count(query);

      // const end = Date.now();

      spinner.succeed();

      console.log(count);
    });
  });
