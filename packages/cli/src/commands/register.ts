import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { password, input } from "@inquirer/prompts";

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

    await withSpinner(async spinner => {
      if (pwd !== confirmPwd) {
        throw new Error("Passwords do not match");
      }

      const client = await getClient();

      await client.get("auth").register({ configuration: { email, password: pwd } }, undefined, undefined, {
        invitationToken: options.invitationToken,
      });

      spinner.succeed("Registration successful");
    });
  });
