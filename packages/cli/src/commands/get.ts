import { Command } from "commander";
import { getClient } from "@/utils";
import ora from "ora";
import qs from "qs";
import Table from "cli-table3";
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
  .option("-o --output <output>", "Output format (json, table)")
  .action(async (modelName, key, options) => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    let list: ModelList<typeof model>;

    await model.initialize();

    let fields: Array<string> = options.fields?.split(",");

    if (!fields?.length) {
      fields = Array.from(new Set(["_id", model.getKeyField(), ...model.fieldsKeys.slice(0, 2)]));
    }

    const populate: Populate = [];

    for (const field of fields) {
      if (field.includes(".")) {
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

    const spinner = ora(`Fetching ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}...`).start();

    try {
      if (key) {
        const res = await model.get(key);
        if (res) {
          list = new ModelList(model, [res]);
        }
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        query.populate ??= populate;
        list = await model.getList(query);
      }

      spinner.succeed(
        `Fetched ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}: ${list.length} result${
          list.length > 1 ? "s" : ""
        } found of ${list.count} total`,
      );
    } catch (e) {
      spinner.fail(`Failed to fetch ${chalk.cyan(model.slug)}: ${(e as Error).message}`);
      return;
    }

    if (!list?.length) {
      return;
    }

    const output = options.output ?? "table";

    if (output === "json") {
      if (options.fields) {
        console.log(chalk.yellow("Fields option is not supported with json output"));
      }

      console.log("");
      console.log(JSON.stringify(list.toJSON(), null, 2));
      return;
    }

    if (output === "table") {
      const table = new Table({
        chars: {
          top: "",
          "top-mid": "",
          "top-left": "",
          "top-right": "",
          bottom: "",
          "bottom-mid": "",
          "bottom-left": "",
          "bottom-right": "",
          left: "",
          "left-mid": "",
          mid: "",
          "mid-mid": "",
          right: "",
          "right-mid": "",
          middle: " ",
        },
        style: { "padding-left": 0, "padding-right": 0 },
        head: fields,
      });

      list.forEach(i => {
        const row: Array<string> = [];
        fields?.forEach(field => {
          row.push(String(i.get(field, "json")));
        });
        table.push(row);
      });

      console.log("");
      console.table(table.toString());
      return;
    }

    console.log(chalk.red(`Invalid output format ${output}`));
  });
