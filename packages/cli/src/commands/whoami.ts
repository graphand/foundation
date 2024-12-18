import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";

export const commandWhoami = new Command("whoami")
  .alias("me")
  .description("Get the current account")
  .action(async () => {
    await withSpinner(async spinner => {
      const client = await getClient();

      console.info("Fetching current account...");

      const account = await client.me();

      if (!account) {
        throw new Error("account not found");
      }

      spinner.succeed("Fetched current account successfully");

      return account?.toJSON();
    });
  });
