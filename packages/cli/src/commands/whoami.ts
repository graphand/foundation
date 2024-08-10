import { Command } from "commander";
import { getClient } from "@/utils";
import { controllerCurrentAccount } from "@graphand/core";
import ora from "ora";

export const commandWhoami = new Command("whoami")
  .alias("me")
  .description("Get the current account")
  .action(async () => {
    const spinner = ora("Fetching current account...").start();

    const client = await getClient();
    spinner.text = "Fetching current account...";

    try {
      const res = await client.execute(controllerCurrentAccount);
      const json = await res.json();

      spinner.succeed("Current account fetched successfully");

      console.log("");
      console.log(JSON.stringify(json.data, null, 2));
    } catch (e) {
      spinner.fail((e as Error).message);
    }
  });
