import fs from "fs";
import qs from "qs";
import { colorizeJson, getClient, getGdxPath, withSpinner } from "@/lib/utils.ts";
import { controllerGdxPull, JSONQuery, JSONTypeObject } from "@graphand/core";
import { Command } from "commander";

export const commandGdxPull = new Command("pull")
  .description("gdx pull")
  .option("-m --models <models>", "List of models to query separated by comma")
  .option("-q --query <query>", "The gdx query object")
  .option("-s --include-system-fields", "Include system fields")
  .option("-o --output <output>", "Output (json, file)")
  .action(options =>
    withSpinner(async () => {
      const client = await getClient();

      let query = qs.parse(options.query || "") as JSONTypeObject;

      if (options.models) {
        const models = String(options.models).split(",");
        models.forEach(m => {
          query[m] ??= true;
        });
      }

      if (!Object.keys(query).length) {
        query = {
          datamodels: true,
        };
      }

      const res = await client.execute(controllerGdxPull, {
        query: {
          omitMeta: true,
          includeSystemFields: options.includeSystemFields,
        },
        data: query as Record<string, JSONQuery | true>,
      });

      const json = await res.json();

      const output = options.output ?? "json";

      if (output === "json") {
        console.log("");
        console.log(colorizeJson(json.data));
        return;
      }

      if (output === "file") {
        const configPath = await getGdxPath();
        if (!configPath) {
          throw new Error("No GDX file found");
        }

        await fs.promises.writeFile(configPath, JSON.stringify(json.data, null, 2));
        return;
      }

      throw new Error(`Invalid output ${output}`);
    }),
  );
