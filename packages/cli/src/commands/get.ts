import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils";
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
  isObjectId,
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
  .action((modelName, key, options) =>
    withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));
      let list: ModelList<typeof model>;

      spinner.text = `Initializing model ${model.slug} ...`;

      await model.initialize();

      let fields: Array<string> = options.fields?.split(",");

      if (!fields?.length) {
        fields = Array.from(new Set(["_id", model.getKeyField(), ...model.fieldsKeys.slice(0, 2)]));
      }

      const populate: Populate = [];

      const nestedFields = fields.filter(f => f.includes("."));
      if (nestedFields.length) {
        spinner.text = `Decoding populated fields ...`;

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

      spinner.text = `Fetching ${model.slug} ${key ? `with key ${key}` : "list"} ...`;

      const start = Date.now();

      if (key) {
        const res = await model.get(key);
        list = res ? new ModelList(model, [res]) : null;
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        query.populate ??= populate;
        list = await model.getList(query);
      }

      const end = Date.now();

      spinner.succeed(
        `Fetched ${model.slug} ${key ? `with key ${key}` : "list"}: ${list.length} result${
          list.length > 1 ? "s" : ""
        } found of ${list.count} total in ${end - start}ms`,
      );

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
        const rows = list.map(i => {
          const row: Array<string> = [];

          fields?.forEach(field => {
            let value = i.get(field, "json");
            if (typeof value === "object") {
              value = JSON.stringify(value);
            }

            if (isObjectId(value)) {
              value = chalk.bold(String(value));
            }

            if (value === undefined) {
              value = chalk.gray("undefined");
            }

            row.push(String(value));
          });

          return row;
        });

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
            middle: "  ",
          },
          style: { "padding-left": 0, "padding-right": 0 },
          colWidths: fields?.map((f, i) => {
            const maxWidth = Math.max(...rows.map(r => String(r[i]).length), f.length);
            return Math.min(maxWidth, 24);
          }),
          head: fields,
        });

        rows.forEach(row => {
          table.push(row);
        });

        console.log("");
        console.table(table.toString());
        return;
      }

      throw new Error(`Invalid output format ${output}`);
    }),
  );
