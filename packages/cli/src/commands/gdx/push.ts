import chalk from "chalk";
import { getClient, loadGdx, withSpinner } from "@/lib/utils.js";
import { controllerGdxPush, JSONTypeObject } from "@graphand/core";
import { Command } from "commander";

export const commandGdxPush = new Command("push")
  .description("gdx push")
  .option("--clean", "Clean")
  .option("--confirm", "Confirm")
  .option("-v --verbose", "Verbose")
  .action(options =>
    withSpinner(async () => {
      const gdx = await loadGdx();

      const client = await getClient();

      const res = await client.execute(controllerGdxPush, {
        query: {
          confirm: options.confirm,
          clean: options.clean,
        },
        data: gdx,
      });

      const json = await res.json();

      if (options.verbose) {
        return json.data;
      }

      const data: Record<string, { create: JSONTypeObject; update: JSONTypeObject; delete: JSONTypeObject }> =
        json.data;

      let lines = [];

      for (const [key, value] of Object.entries(data)) {
        if (value.create && Object.keys(value.create).length) {
          const verb = options.confirm ? "created" : "creating";
          lines.push(`${verb} ${Object.keys(value.create).length} ${key}`);
        }

        if (value.update && Object.keys(value.update).length) {
          const verb = options.confirm ? "updated" : "updating";
          lines.push(`${verb} ${Object.keys(value.update).length} ${key}`);
        }

        if (value.delete && Object.keys(value.delete).length) {
          const verb = options.confirm ? "deleted" : "deleting";
          lines.push(`${verb} ${Object.keys(value.delete).length} ${key}`);
        }
      }

      if (!lines.length) {
        console.log(chalk.gray("Already up to date"));
        return;
      }

      console.log(chalk.gray("Use --verbose (-v) option to see the details"));
      console.log("");

      lines.forEach(line => console.log(chalk.green(line)));
    }),
  );
