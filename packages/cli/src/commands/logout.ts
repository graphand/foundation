import { Command } from "commander";
import { getClient } from "@/lib/utils.js";
import chalk from "chalk";

export const commandLogout = new Command("logout").description("Logout from the Graphand API").action(async () => {
  const client = await getClient();
  await client.get("auth").logout();

  console.log(chalk.green("Logout successful"));
});
