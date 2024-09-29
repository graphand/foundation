import { Command } from "commander";
import { getClient } from "@/lib/utils";
import { password, input } from "@inquirer/prompts";
import chalk from "chalk";

export const commandRegister = new Command("register")
  .option("-i --invitation-token <invitationToken>", "Invitation token")
  .description("Register with the Graphand API")
  .action(async options => {
    const email = await input({
      message: "Email",
    });
    const pwd = await password({
      message: "Password",
      mask: "*",
    });
    const confirmPwd = await password({
      message: "Confirm Password",
      mask: "*",
    });

    if (pwd !== confirmPwd) {
      console.log(chalk.red("Passwords do not match"));
      return;
    }

    const client = await getClient();

    await client.get("auth").register({ configuration: { email, password: pwd } }, undefined, undefined, {
      invitationToken: options.invitationToken,
    });

    console.log(chalk.green("Registration successful"));
  });
