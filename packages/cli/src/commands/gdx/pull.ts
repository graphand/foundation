import fs from "fs";
import qs from "qs";
import { colorizeJson, getClient, getGdxPath, withSpinner } from "@/lib/utils.js";
import { controllerGdxPull, JSONQuery, JSONObject } from "@graphand/core";
import { Command } from "commander";
import { Config } from "@/lib/Config.js";
import path from "path";

export const commandGdxPull = new Command("pull")
  .description("gdx pull")
  .option("-m --models <models>", "List of models to query separated by comma")
  .option("-q --query <query>", "The gdx query object")
  .option("-s --include-system-properties", "Include system properties")
  .option("-o --output <output>", "Output (json, file)")
  .option("-w --write <path>", "Write to gdx file")
  .action(async options => {
    await withSpinner(async () => {
      const client = await getClient();

      let query = qs.parse(options.query || "") as JSONObject;

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
          includeSystemProperties: options.includeSystemProperties,
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
        let gdxPath: string | null = null;

        if (options.write) {
          gdxPath = path.join(process.cwd(), options.write);
        } else {
          const config = await new Config().load();
          gdxPath = await getGdxPath(config);
        }

        if (!gdxPath) {
          throw new Error("No GDX file found");
        }

        if (path.extname(gdxPath) !== ".json") {
          throw new Error("GDX file must be a json file");
        }

        await fs.promises.writeFile(gdxPath, JSON.stringify(json.data, null, 2));
        return;
      }

      throw new Error(`Invalid output ${output}`);
    });
  });
