import { Command } from "commander";
import { getClient } from "@/utils";
import { controllerEntry } from "@graphand/core";
import ora from "ora";
import chalk from "chalk";

export const commandEntry = new Command("entry")
  .description("Fetch the entry point of your project")
  .action(async () => {
    const spinner = ora("Initializing client...").start();

    const client = await getClient();
    spinner.text = "Fetching entry point...";

    const res = await client.execute(controllerEntry);
    const json = await res.json();

    spinner.succeed("Entry point fetched successfully");

    console.log("\nProject Details:");
    console.log(chalk.cyan("Base URL:"), client.getBaseUrl());
    console.log(chalk.cyan("Entry Point Data:"));
    console.log(JSON.stringify(json.data, null, 2));
  });
