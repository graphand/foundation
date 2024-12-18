import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { controllerEntry } from "@graphand/core";
import chalk from "chalk";

export const commandEntry = new Command("entry")
  .description("Fetch the entry point of your project")
  .action(async () => {
    await withSpinner(async spinner => {
      const client = await getClient();

      console.info("Fetching entry point: " + chalk.cyan(client.getBaseUrl()));

      const res = await client.execute(controllerEntry);
      const json = await res.json();

      spinner.succeed("Fetched entry point successfully: " + chalk.cyan(client.getBaseUrl()));

      return json.data;
    });
  });
