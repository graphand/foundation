import { Command } from "commander";
import fs from "fs";
import path from "path";
import { isObjectId } from "@graphand/core";
import chalk from "chalk";
import { confirm, input } from "@inquirer/prompts";
import { Config } from "@/lib/Config.js";

export const commandInit = new Command("init").description("Initialize a new Graphand project").action(async () => {
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

  const configPath = Config.getPath();
  let config: Config;

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
      config = await new Config().load();
    } catch (e) {
      console.log(chalk.yellow("Failed to load configuration file"));
    }
  }

  config ??= new Config();

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
    default: config?.client?.environment ?? "main",
  });

  const userConfig = config.get();

  if (userConfig) {
    userConfig.client ??= { project, environment };
    userConfig.client.project = project;
    userConfig.client.environment = environment;
  } else {
    config.setConfig({
      client: {
        project,
        environment,
      },
    });
  }

  await config.save();
});
