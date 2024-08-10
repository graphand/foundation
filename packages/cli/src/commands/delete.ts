import { Command } from "commander";
import { getClient } from "@/utils";
import ora from "ora";
import chalk from "chalk";
import { ModelInstance } from "@graphand/core";

export const commandDelete = new Command("delete")
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
