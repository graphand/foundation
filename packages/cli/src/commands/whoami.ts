import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.ts";

export const commandWhoami = new Command("whoami")
  .alias("me")
  .description("Get the current account")
  .action(() =>
    withSpinner(async spinner => {
      const client = await getClient({ realtime: true });

      spinner.text = "Fetching current account...";

      const account = await client.me();

      if (!account) {
        throw new Error("account not found");
      }

      spinner.succeed("Fetched current account successfully");

      return account?.toJSON();
    }),
  );
