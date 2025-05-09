import qs from "qs";
import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { JSONQuery, ModelInstance, ModelList } from "@graphand/core";
import Collector from "@/lib/Collector.js";

export const commandUpdate = new Command("update")
  .description("Update a list of instances")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .option(
    "--set <set>",
    "Set properties with URL encoded key=value (property1=value1&property2=value2)",
    Collector.setter,
  )
  .action(async (modelName: string, key: string | undefined, options) => {
    await withSpinner(async spinner => {
      const client = await getClient({ realtime: true });
      const model = client.model(modelName);

      console.info(`Initializing model ${model.configuration.slug} ...`);

      await model.initialize();

      let list: ModelList<typeof model> | null;

      if (key) {
        const res = await model.get(key);
        list = res ? new ModelList(model, [res]) : null;
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        list = await model.getList(query);
      }

      if (!list?.length) {
        throw new Error(`No instance found to update`);
      }

      console.info(`Updating ${list.length} instance(s) of ${model.configuration.slug} ...`);

      let updated: Array<ModelInstance<typeof model>>;

      if (!model.configuration.noBulk) {
        const ids = list.getIds();
        updated = await model.update({ ids }, { $set: options.set });
      } else {
        if (list.length > 1) {
          throw new Error(`updateMultiple operation is not allowed on ${model.configuration.slug}`);
        }

        const i = list[0];
        if (!i) {
          throw new Error(`Instance not found`);
        }
        await i.update({ $set: options.set });
        updated = [i];
      }

      spinner.succeed(`Updated ${updated.length} instance(s) of ${model.configuration.slug} successfully`);

      return updated.map(i => i.toJSON());
    });
  });
