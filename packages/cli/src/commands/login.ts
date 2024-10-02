import { Command } from "commander";
import { getClient } from "@/lib/utils.js";
import { password, input } from "@inquirer/prompts";
import chalk from "chalk";
import { AuthMethods, AuthProviders } from "@graphand/core";
import qs from "qs";

export const commandLogin = new Command("login")
  .description("Login with the Graphand API")
  .option("-p --provider <provider>", "Authentication provider")
  .option("-m --method <method>", "Authentication method")
  .option("-t --tokens <tokens>", "URL encoded access & refresh tokens")
  .option("--set-access-token <accessToken>", "Set access token")
  .action(async function ({ provider, method, tokens, setAccessToken }) {
    const client = await getClient();

    if (setAccessToken) {
      const refreshToken = await client.get("auth").storage?.getItem("refreshToken");
      client.get("auth").setTokens(String(setAccessToken), String(refreshToken));
      return;
    }

    provider ??= AuthProviders.LOCAL;
    method ??= AuthMethods.CODE;
    let credentials: Record<string, string> = {};

    if (tokens) {
      const { accessToken, refreshToken } = qs.parse(tokens);
      if (!accessToken || !refreshToken) {
        throw new Error("Access & refresh tokens are required");
      }

      client.get("auth").setTokens(String(accessToken), String(refreshToken));
      console.log(chalk.green("Tokens set successfully"));
      return;
    }

    if (method !== AuthMethods.CODE) {
      throw new Error("Only CODE method is supported with cli");
    }

    if (provider === AuthProviders.LOCAL) {
      credentials.email = await input({
        message: "Email",
      });
      credentials.password = await password({
        message: "Password",
        mask: "*",
      });
    }

    const res = await client.get("auth").login({ credentials, provider, method });

    if (res) {
      console.log(chalk.green("Login successful"));
      return;
    }

    const code = await input({
      message: "Enter the code",
    });

    await client.get("auth").handleCode(code);

    console.log(chalk.green("Login successful"));
  });
