#!/usr/bin/env node

import { Command } from "commander";
import { input, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import { version } from "../package.json";
import {
  AuthMethods,
  AuthProviders,
  controllerCurrentAccount,
  controllerEntry,
  controllerModelCount,
  controllerModelCreate,
  controllerModelDelete,
  controllerModelQuery,
  controllerModelRead,
  controllerModelUpdate,
  FieldTypes,
  getFieldsPathsFromPath,
  getRelationModelsFromPath,
  isObjectId,
  JSONQuery,
  ModelInstance,
  ModelJSON,
  ModelList,
  Populate,
  PopulateOption,
} from "@graphand/core";
import { UserConfig } from "./types";
import fs from "node:fs";
import path from "node:path";
import { getClient, loadConfig, loadConfigFile, rmConfigFile } from "@/utils";
import ora from "ora";
import qs from "qs";
import { FetchError } from "@graphand/client";
import Table from "cli-table3";

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

    const _handleRes = async (res: Response) => {
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
      const r = await client.execute(controller, {
        params: options.params ? (qs.parse(options.params) as Record<string, string>) : undefined,
        query: options.query ? (qs.parse(options.query) as Record<string, string>) : undefined,
        init: {
          body: options.data ? JSON.stringify(qs.parse(options.data)) : undefined,
        },
      });

      await _handleRes(r);
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

program
  .command("get")
  .alias("query")
  .alias("list")
  .description("Get a model")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .option("-f --fields <fields>", "Fields to display (comma separated)")
  .option("-o --output <output>", "Output format (json, table)")
  .action(async (modelName, key, options) => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    let list: ModelList<typeof model>;

    await model.initialize();

    let fields: Array<string> = options.fields?.split(",");

    if (!fields?.length) {
      fields = Array.from(new Set(["_id", model.getKeyField(), ...model.fieldsKeys.slice(0, 2)]));
    }

    const populate: Populate = [];

    for (const field of fields) {
      if (field.includes(".")) {
        const models = await getRelationModelsFromPath(model, field);
        await Promise.all(models.map(m => m.initialize()));
        const paths = getFieldsPathsFromPath(model, field);
        const pop: Partial<PopulateOption> = {};
        let cursor = pop;
        for (const p of paths) {
          if (p?.field?.type === FieldTypes.RELATION) {
            cursor.path = p.field.path;
            const subpop: Partial<PopulateOption> = {};
            cursor.populate = subpop as PopulateOption;
            cursor = subpop;
          }
        }

        if (Object.keys(pop).length) {
          populate.push(pop as PopulateOption);
        }
      }
    }

    const spinner = ora(`Fetching ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}...`).start();

    try {
      if (key) {
        const res = await model.get(key);
        if (res) {
          list = new ModelList(model, [res]);
        }
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        query.populate ??= populate;
        list = await model.getList(query);
      }

      spinner.succeed(
        `Fetched ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}: ${list.length} result${
          list.length > 1 ? "s" : ""
        } found of ${list.count} total`,
      );
    } catch (e) {
      spinner.fail(`Failed to fetch ${chalk.cyan(model.slug)}: ${(e as Error).message}`);
      return;
    }

    if (!list?.length) {
      return;
    }

    const output = options.output ?? "table";

    if (output === "json") {
      if (options.fields) {
        console.log(chalk.yellow("Fields option is not supported with json output"));
      }

      console.log("");
      console.log(JSON.stringify(list.toJSON(), null, 2));
      return;
    }

    if (output === "table") {
      const table = new Table({
        chars: {
          top: "",
          "top-mid": "",
          "top-left": "",
          "top-right": "",
          bottom: "",
          "bottom-mid": "",
          "bottom-left": "",
          "bottom-right": "",
          left: "",
          "left-mid": "",
          mid: "",
          "mid-mid": "",
          right: "",
          "right-mid": "",
          middle: " ",
        },
        style: { "padding-left": 0, "padding-right": 0 },
        head: fields,
      });

      list.forEach(i => {
        const row: Array<string> = [];
        fields?.forEach(field => {
          row.push(String(i.get(field, "json")));
        });
        table.push(row);
      });

      console.log("");
      console.table(table.toString());
      return;
    }

    console.log(chalk.red(`Invalid output format ${output}`));
  });

program
  .command("describe")
  .alias("read")
  .description("Get a model")
  .arguments("<modelName> [key]")
  .option("-q --query <query>", "URL encoded JSONQuery object")
  .action(async (modelName, key, options) => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    let instance: ModelInstance<typeof model>;

    await model.initialize();

    const spinner = ora(`Fetching ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}...`).start();

    try {
      if (key) {
        instance = await model.get(key);
      } else {
        const query: JSONQuery = options.query ? qs.parse(options.query) : {};
        query.limit = Number(query.limit) || undefined;
        query.pageSize = Number(query.pageSize) || undefined;
        instance = await model.get(query);
      }

      spinner.succeed(`Fetched ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"} successfully`);
    } catch (e) {
      spinner.fail(`Failed to fetch ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}`);
      console.log(JSON.stringify(e, null, 2));
      return;
    }

    if (!instance) {
      return;
    }

    let fields: Array<string> = options.fields?.split(",");

    if (!fields?.length) {
      fields = Array.from(new Set(["_id", model.getKeyField()]));
    }

    console.log("");
    console.log(JSON.stringify(instance.toJSON(), null, 2));
  });

program
  .command("delete")
  .description("Delete an instance")
  .arguments("<modelName> [key]")
  .action(async (modelName, key) => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    let instance: ModelInstance<typeof model>;

    await model.initialize();

    if (key) {
      instance = await model.get(key);
    } else {
      instance = await model.get();
    }

    if (!instance) {
      console.log(chalk.red(`Instance not found`));
      return;
    }

    const spinner = ora(`Deleting ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}...`).start();

    await instance.delete();

    spinner.succeed(`Deleted ${chalk.cyan(model.slug)} ${key ? `with key ${key}` : "list"}`);
  });

program
  .command("create")
  .description("Create a new instance")
  .arguments("<modelName>")
  .action(async modelName => {
    const client = await getClient();
    const model = client.getModel(String(modelName));
    const data: ModelJSON<typeof model> = {};

    await model.initialize();

    for (const field of model.fieldsMap.values()) {
      if (field.path.startsWith("_")) {
        continue;
      }

      if (
        [
          FieldTypes.TEXT,
          FieldTypes.NUMBER,
          FieldTypes.ID,
          FieldTypes.IDENTITY,
          FieldTypes.RELATION,
          FieldTypes.NESTED,
          FieldTypes.ARRAY,
        ].includes(field.type)
      ) {
        let value: any = await input({
          message: chalk.yellow(field.path),
        });

        if (field.type === FieldTypes.NUMBER) {
          value = Number(value);
        }

        if (field.type === FieldTypes.NESTED) {
          value = value ? JSON.parse(value) : undefined;
        }

        data[field.path as keyof ModelJSON<typeof model>] = value;
      }
    }

    const spinner = ora(`Creating ${chalk.cyan(model.slug)}...`).start();

    const instance = await model.create(data);

    spinner.succeed(`Created ${chalk.cyan(model.slug)} successfully`);

    console.log("");
    console.log(JSON.stringify(instance.toJSON(), null, 2));
  });

program.parse(process.argv);
