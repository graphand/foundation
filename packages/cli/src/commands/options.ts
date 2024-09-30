import { Command } from "commander";
import { getClient } from "@/lib/utils.ts";

export const commandOptions = new Command("options").description("See client options").action(async () => {
  const client = await getClient();
  console.log(JSON.stringify(client.options, null, 2));
});
