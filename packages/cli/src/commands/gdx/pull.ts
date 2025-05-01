import fs from "fs";
import qs from "qs";
import { colorizeJson, getClient, getGdxPath, loadGdx, withSpinner } from "@/lib/utils.js";
import { controllerGdxPull, JSONQuery, JSONObject } from "@graphand/core";
import { Command } from "commander";
import { Config } from "@/lib/Config.js";
import path from "path";
import { confirm } from "@inquirer/prompts";

export const commandGdxPull = new Command("pull")
  .description("gdx pull")
  .option("-m --models <models>", "List of models to query separated by comma")
  .option("-q --query <query>", "The gdx query object")
  .option("-d --detect-query", "Detect query from models")
  .option(
    "-e --expand-query",
    "Expand query from models, get all instances of the model instead of only the detected ones",
  )
  .option("-s --include-system-properties", "Include system properties")
  .option("-o --output <output>", "Output (json, file)")
  .option("-w --write <path>", "Write to gdx file")
  .action(async options => {
    await withSpinner(async () => {
      const client = await getClient();

      let query = qs.parse(options.query || "") as JSONObject;

      if (options.detectQuery) {
        const { json } = await loadGdx({ client });

        for await (const [key, data] of Object.entries(json)) {
          const model = client.model(key);
          await model.initialize();

          if (model.configuration.single || options.expandQuery) {
            query[key] = true;
          } else if (data && typeof data === "object") {
            query[key] = {
              filter: {
                [model.getKeyProperty()]: {
                  $in: Object.keys(data),
                },
              },
            };
          }
        }
      }

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

        if (!gdxPath || path.extname(gdxPath) !== ".json") {
          globalThis.spinner?.stop();

          const shouldCreate = await confirm({
            message: `No json file found. Do you want to create graphand.gdx.json file ?`,
            default: true,
          });

          if (shouldCreate) {
            // Create directory if it doesn't exist
            gdxPath = path.join(process.cwd(), "graphand.gdx.json");
          } else {
            throw new Error(`GDX file not found: ${gdxPath}`);
          }
        }

        await fs.promises.writeFile(gdxPath, JSON.stringify(json.data, null, 2));
        return;
      }

      throw new Error(`Invalid output ${output}`);
    });
  });
