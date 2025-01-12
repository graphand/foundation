import { Command } from "commander";
import { colorizeJson, getClient, getTable, withSpinner } from "@/lib/utils.js";
import qs from "qs";
import {
  getFieldsPathsFromPath,
  getRelationModelsFromPath,
  ModelList,
  JSONQuery,
  FieldTypes,
  Populate,
  PopulateOption,
} from "@graphand/core";
import chalk from "chalk";

export const commandGet = new Command("get")
  .alias("query")
  .alias("list")
  .description("Get a model")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .option("-f --fields <fields>", "Fields to display (comma separated)")
  .option("-o --output <output>", "Output format (json, table, raw)")
  .option("-w --max-width <maxWidth>", "The max width of the output table (default: 70)")
  .option("-1", "Sort by -_id")
  .option("--last", "Get the last created item")
  .action(async (modelName, key, options) => {
    await withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));
      let list: ModelList<typeof model> | null;

      console.info(`Initializing model ${model.slug} ...`);

      await model.initialize();

      let fields = Array.from(new Set(["_id", model.getKeyField(), ...model.fieldsKeys.slice(0, 2)]));

      if (options.fields) {
        if (options.fields.startsWith("+")) {
          fields = fields.concat(options.fields.slice(1).split(","));
        } else {
          fields = options.fields.split(",");
        }
      }

      const populate: Populate = [];

      const nestedFields = fields.filter(f => f.includes("."));
      if (nestedFields.length) {
        console.info(`Decoding populated fields ...`);

        for (const field of nestedFields) {
          const models = await getRelationModelsFromPath(model, field);
          await Promise.all(models.map(m => m.initialize()));
          const paths = getFieldsPathsFromPath(model, field);
          const pop: Partial<PopulateOption> = {};
          let cursor = pop;
          for (const p of paths) {
            if (p?.field?.type === FieldTypes.RELATION) {
              cursor.path = p.field.path;
              const subpop: Partial<PopulateOption> = {};
              cursor.populate = subpop as PopulateOption;
              cursor = subpop;
            }
          }

          if (Object.keys(pop).length) {
            populate.push(pop as PopulateOption);
          }
        }
      }

      console.info(`Fetching ${model.slug} ${key ? `with key ${key}` : "list"} ...`);

      const start = Date.now();

      if (key) {
        const res = await model.get(key);
        list = res ? new ModelList(model, [res]) : null;
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        if (options.last) {
          query.limit = 1;
          query.sort = { _id: -1 };
        } else {
          query.limit = Number(query.limit) || undefined;
          query.pageSize = Number(query.pageSize) || undefined;
          query.populate ??= populate;
          query.sort ??= options["1"] ? { _id: -1 } : undefined;
        }

        list = await model.getList(query);
      }

      const end = Date.now();

      if (!list) {
        throw new Error(`Not found`);
      }

      spinner.succeed(
        `Fetched ${model.slug} ${key ? `with key ${key}` : "list"}: ${list.length} result${
          list.length > 1 ? "s" : ""
        } found of ${list.count} total in ${end - start}ms`,
      );

      if (!list?.length) {
        return;
      }

      const output = options.output ?? "table";

      if (output === "raw") {
        if (list.length > 1) {
          console.log(chalk.yellow("Only one item can be displayed with raw output"));
        }

        const first = list[0];
        console.log("");
        console.log(JSON.stringify(first?.getData(), null, 2));
        return;
      }

      if (output === "json") {
        if (options.fields) {
          console.log(chalk.yellow("Fields option is not supported with json output"));
        }

        console.log("");
        console.log(colorizeJson(list.toJSON()));
        return;
      }

      if (output === "table") {
        const table = getTable({
          maxWidth: options.maxWidth,
          fields,
          list,
          getter: (item, field) => item.get(field, "json"),
          isImportantField: field => getFieldsPathsFromPath(model, field).pop()?.field?.type === FieldTypes.ID,
          getNaturalWidth: path => {
            const field = getFieldsPathsFromPath(model, String(path)).pop()?.field;
            const isIdField = field && field.type === FieldTypes.ID;

            if (isIdField) {
              // Pour les champs de type ID, fixer la largeur à 24
              return 24;
            } else {
              const values = list?.map(item => String(item.get(path, "json"))) || [];
              const maxContentWidth = Math.max(...values.map(value => value.length), path.length);
              return maxContentWidth;
            }
          },
        });

        console.log("");
        console.log(table);
        return;
      }

      throw new Error(`Invalid output format ${output}`);
    });
  });
