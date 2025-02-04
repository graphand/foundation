import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { password, input } from "@inquirer/prompts";
import chalk from "chalk";
import { AuthMethods, AuthProviders } from "@graphand/core";
import qs from "qs";

export const commandLogin = new Command("login")
  .description("Login with the Graphand API")
  .option("-p --provider <provider>", "Authentication provider")
  .option("-m --method <method>", "Authentication method")
  .option("-t --tokens <tokens>", "URL encoded access & refresh tokens")
  .option("-d --credentials <credentials>", "URL encoded credentials")
  .option("--set-access-token <accessToken>", "Set access token")
  .action(async function ({ provider, method, tokens, credentials: _credentials, setAccessToken }) {
    const client = await getClient();

    if (setAccessToken) {
      const refreshToken = await client.get("auth").storage?.getItem("refreshToken");
      client.get("auth").setTokens({ accessToken: String(setAccessToken), refreshToken: String(refreshToken) });
      return;
    }

    provider ??= AuthProviders.LOCAL;
    method ??= AuthMethods.CODE;
    let credentials = qs.parse(_credentials || "") as Record<string, string>;

    if (tokens) {
      const { accessToken, refreshToken } = qs.parse(tokens);
      if (!accessToken || !refreshToken) {
        throw new Error("Access & refresh tokens are required");
      }

      client.get("auth").setTokens({ accessToken: String(accessToken), refreshToken: String(refreshToken) });
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

    let isLogged = false;

    await withSpinner(async spinner => {
      try {
        const res = await client.get("auth").login({ credentials, provider, method });

        if (res) {
          spinner.succeed(`Login successful for ${res.account._email}`);
          isLogged = true;
        } else {
          spinner.succeed("Logging in...");
        }
      } catch (e) {
        spinner.fail(`Login failed: ${(e as Error).message}`);
      }
    });

    if (isLogged) {
      return;
    }

    const code = await input({
      message: "Enter the code",
    });

    await withSpinner(async spinner => {
      try {
        const res = await client.get("auth").handleCode(code);

        if (!res) {
          throw new Error("Login failed with empty response");
        }

        spinner.succeed(`Login successful for ${res.account._email}`);
      } catch (e) {
        spinner.fail(`Login failed: ${(e as Error).message}`);
      }
    });
  });
