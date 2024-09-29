import { Command } from "commander";
import { colorizeJson, getClient, withSpinner } from "@/lib/utils";
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
  .option("-o --output <output>", "Output format (json, table, raw)")
  .option("-w --max-width <maxWidth>", "The max width of the output table (default: 70)")
  .option("-1", "Sort by -_id")
  .option("--last", "Get the last created item")
  .action((modelName, key, options) =>
    withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));
      let list: ModelList<typeof model>;

      spinner.text = `Initializing model ${model.slug} ...`;

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
        console.log(JSON.stringify(first.getData(), null, 2));
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
        const maxWidth = Number(options.maxWidth || 70);

        // Compute the natural widths for each column based on the maximum cell content width
        const naturalWidths = fields.map(field => {
          const values = list.map(item => String(item.get(field, "json")));
          const maxContentWidth = Math.max(...values.map(value => value.length), field.length);
          return maxContentWidth;
        });

        // Create a copy of naturalWidths to adjust
        let columnWidths = [...naturalWidths];

        const totalNaturalWidth = naturalWidths.reduce((sum, width) => sum + width, 0);

        if (totalNaturalWidth > maxWidth) {
          // Calculate how much we need to reduce the widths
          const widthToReduce = totalNaturalWidth - maxWidth;

          // Create an array of column indices sorted by natural width (descending)
          const sortedIndices = naturalWidths
            .map((width, index) => ({ width, index }))
            .sort((a, b) => b.width - a.width)
            .map(obj => obj.index);

          // Distribute the reduction among the widest columns
          let remainingReduction = widthToReduce;

          for (const idx of sortedIndices) {
            if (remainingReduction <= 0) break;

            // Set a minimum column width (e.g., 30% of natural width or at least 5)
            const minColWidth = Math.max(5, naturalWidths[idx] * 0.3);
            const maxReduction = columnWidths[idx] - minColWidth;

            if (maxReduction > 0) {
              const reduction = Math.min(maxReduction, remainingReduction);
              columnWidths[idx] -= reduction;
              remainingReduction -= reduction;
            }
          }

          // If after distributing the reduction we still have remaining reduction,
          // we need to reduce all columns proportionally
          if (remainingReduction > 0) {
            const totalAdjustableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
            const scalingFactor = (totalAdjustableWidth - remainingReduction) / totalAdjustableWidth;

            columnWidths = columnWidths.map(width => Math.max(5, Math.floor(width * scalingFactor)));
          }
        }

        // Ensure column widths are integers
        columnWidths = columnWidths.map(Math.floor);

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
          colWidths: columnWidths,
          head: fields,
        });

        list.forEach(item => {
          const row = fields.map(field => {
            let value = item.get(field, "json");

            if (typeof value === "object") {
              value = JSON.stringify(value);
            }

            if (isObjectId(value)) {
              value = chalk.bold(String(value));
            }

            if (value === undefined) {
              value = chalk.gray("undefined");
            }

            return String(value);
          });

          table.push(row);
        });

        console.log("");
        console.log(table.toString());
        return;
      }

      throw new Error(`Invalid output format ${output}`);
    }),
  );
