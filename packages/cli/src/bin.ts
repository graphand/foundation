#!/usr/bin/env node

import { Command } from "commander";
import { input, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import { version } from "../package.json";
import {
  AuthMethods,
  AuthProviders,
  Controller,
  controllerCurrentAccount,
  controllerEntry,
  controllerModelCount,
  controllerModelCreate,
  controllerModelDelete,
  controllerModelQuery,
  controllerModelRead,
  controllerModelUpdate,
  isObjectId,
} from "@graphand/core";
import { UserConfig } from "./types";
import fs from "node:fs";
import path from "node:path";
import { getClient, loadConfig, loadConfigFile, rmConfigFile } from "@/utils";
import ora from "ora";
import qs from "qs";
import { FetchError } from "@graphand/client";

const controllers = {
  modelCount: controllerModelCount,
  modelCreate: controllerModelCreate,
  modelDelete: controllerModelDelete,
  modelQuery: controllerModelQuery,
  modelRead: controllerModelRead,
  modelUpdate: controllerModelUpdate,
  currentAccount: controllerCurrentAccount,
  entry: controllerEntry,
};

const program = new Command();

program.version(version).description("Graphand CLI !");

program
  .command("init")
  .description("Initialize a new Graphand project")
  .action(async () => {
    const hasPackageJson = fs.existsSync(path.join(process.cwd(), "package.json"));

    if (!hasPackageJson) {
      const answer = await confirm({
        message: chalk.yellow(
          "No package.json found. Do you want to initialize a graphand project in the current directory?",
        ),
        default: false,
      });

      if (!answer) {
        return;
      }
    }

    let config: Partial<UserConfig> = {};
    const configPath = loadConfigFile();

    if (configPath) {
      const filename = path.basename(configPath);
      const answer = await confirm({
        message: chalk.yellow(`A ${filename} file already exists. Do you want to overwrite it?`),
        default: false,
      });

      if (!answer) {
        return;
      }

      try {
        config = await loadConfig();
      } catch (e) {
        console.log(chalk.yellow("Failed to load configuration file"));
      }
    }

    const project = await input({
      message: "What is your project id?",
      default: config?.client?.project ?? "",
    });

    if (!project) {
      console.log(chalk.red("Project id is required"));
      return;
    }

    if (!isObjectId(project)) {
      console.log(chalk.red("Project id is not valid. Format: a-z0-9, 24 characters"));
      return;
    }

    const environment = await input({
      message: "Which environment do you want to start with?",
      default: config?.client?.environment ?? "master",
    });

    if (config.client) {
      config.client.project = project;
      config.client.environment = environment;
    } else {
      config.client = { project, environment };
    }

    const content = `
      import { defineConfig } from "@graphand/cli";

      export default defineConfig($CONFIG);
    `
      .replaceAll("  ", "")
      .replaceAll("$CONFIG", JSON.stringify(config, null, 2))
      .trim();

    rmConfigFile();

    fs.writeFileSync(path.join(process.cwd(), "graphand.config.js"), content);
  });

program
  .command("entry")
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

program
  .command("register")
  .description("Register with the Graphand API")
  .action(async () => {
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
    await client.get("auth").register({ configuration: { email, password: pwd } });

    console.log(chalk.green("Registration successful"));
  });

program
  .command("login")
  .description("Login with the Graphand API")
  .option("-p --provider <provider>", "Authentication provider")
  .option("-m --method <method>", "Authentication method")
  .option("-t --tokens <tokens>", "URL encoded access & refresh tokens")
  .action(async function ({ provider, method, tokens }) {
    const client = await getClient();
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

program
  .command("logout")
  .description("Logout from the Graphand API")
  .action(async () => {
    const client = await getClient();
    await client.get("auth").logout();

    console.log(chalk.green("Logout successful"));
  });

program
  .command("options")
  .description("See client options")
  .action(async () => {
    const client = await getClient();
    console.log(JSON.stringify(client.options, null, 2));
  });

program
  .command("currentAccount")
  .description("Get the current account")
  .action(async () => {
    const spinner = ora("Fetching current account...").start();

    const client = await getClient();
    spinner.text = "Fetching current account...";

    const res = await client.execute(controllerCurrentAccount);
    const json = await res.json();

    spinner.succeed("Current account fetched successfully");

    console.log("\nCurrent Account:");
    console.log(chalk.cyan("Account ID:"), json.data._id);
    console.log(chalk.cyan("Email:"), json.data._email);
  });

program
  .command("execute")
  .alias("exec")
  .alias("e")
  .arguments("<controllerName>")
  .option("-p --params <params>", "URL encoded params options")
  .option("-q --query <query>", "URL encoded query options")
  .option("-d --data <data>", "URL encoded data options")
  .option("-e --explain", "Explain the query")
  .description("Execute a Graphand API endpoint")
  .action(async (controllerName, options) => {
    if (!controllerName) {
      console.log(chalk.red("Controller name is required"));
      return;
    }

    const controller = controllers[controllerName as keyof typeof controllers];

    if (!controller) {
      console.log(chalk.red(`Controller ${controllerName} not found`));
      return;
    }

    if (options.explain) {
      console.log(
        JSON.stringify(
          {
            controller,
            path: options.path ? (qs.parse(options.path) as Record<string, string>) : undefined,
            query: options.query ? (qs.parse(options.query) as Record<string, string>) : undefined,
            init: {
              body: options.data ? JSON.stringify(qs.parse(options.data)) : undefined,
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    const startAt = Date.now();

    const spinner = ora(`Executing ${chalk.cyan(controllerName)}...`).start();

    const client = await getClient();

    const _handleRes: (res: Response) => Promise<void> = async res => {
      const endAt = Date.now();
      const duration = endAt - startAt;

      const message = `Executed ${chalk.cyan(controllerName)} in ${duration}ms with status ${res.status}`;

      if (res.ok) {
        spinner.succeed(message);

        const json = await res.json();

        console.log(JSON.stringify(json, null, 2));
      } else {
        spinner.fail(message);
      }
    };

    try {
      const res = await client.execute(controller, {
        params: options.params ? (qs.parse(options.params) as Record<string, string>) : undefined,
        query: options.query ? (qs.parse(options.query) as Record<string, string>) : undefined,
        init: {
          body: options.data ? JSON.stringify(qs.parse(options.data)) : undefined,
        },
      });

      await _handleRes(res);
    } catch (e) {
      if (e instanceof FetchError) {
        await _handleRes(e.res);
      } else {
        spinner.fail(`Failed to execute ${chalk.cyan(controllerName)}`);
      }

      console.log(JSON.stringify(e, null, 2));
      return;
    }
  });

program.parse(process.argv);
