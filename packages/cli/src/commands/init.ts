import { Command } from "commander";
import { UserConfig } from "@/types";
import fs from "fs";
import path from "path";
import { loadConfig, getConfigPath, rmConfigFile } from "@/lib/utils";
import { isObjectId } from "@graphand/core";
import chalk from "chalk";
import { confirm, input } from "@inquirer/prompts";

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

  let config: Partial<UserConfig> = {};
  const configPath = getConfigPath();

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
