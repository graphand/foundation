import qs from "qs";
import { Command } from "commander";
import { collectSetter, getClient, withSpinner } from "@/lib/utils";
import { JSONQuery, ModelInstance, ModelList } from "@graphand/core";

export const commandUpdate = new Command("update")
  .description("Update a list of instances")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .option("--set <set>", "Set fields with URL encoded key=value (field1=value1&field2=value2)", collectSetter, {})
  .action((modelName, key, options) =>
    withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));

      spinner.text = `Initializing model ${model.slug} ...`;

      await model.initialize();

      let list: ModelList<typeof model>;

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

      spinner.text = `Updating ${list.length} instance(s) of ${model.slug} ...`;

      let updated: Array<ModelInstance<typeof model>>;

      if (model.allowMultipleOperations) {
        const ids = list.getIds();
        updated = await model.update({ ids }, { $set: options.set });
      } else {
        if (list.length > 1) {
          throw new Error(`updateMultiple operation is not allowed on ${model.slug}`);
        }

        const i = list[0];
        await i.update({ $set: options.set });
        updated = [i];
      }

      spinner.succeed(`Updated ${updated.length} instance(s) of ${model.slug} successfully`);

      const json = updated.map(i => i.toJSON());

      console.log("");
      console.log(JSON.stringify(json, null, 2));
    }),
  );