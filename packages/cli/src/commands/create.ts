import chalk from "chalk";
import { Command } from "commander";
import { collectSetter, getClient, withSpinner } from "@/lib/utils";

export const commandCreate = new Command("create")
  .alias("new")
  .description("Create a new instance")
  .arguments("<modelName>")
  .option("--set <set>", "Set fields with URL encoded key=value (field1=value1&field2=value2)", collectSetter, {})
  .action((modelName, options) =>
    withSpinner(async spinner => {
      const client = await getClient();
      const model = client.getModel(String(modelName));

      spinner.text = `Initializing model ${model.slug} ...`;

      await model.initialize();

      spinner.text = `Creating ${chalk.cyan(model.slug)} instance...`;

      const instance = await model.create(options.set);

      spinner.succeed(`Created ${chalk.cyan(model.slug)} instance successfully with _id ${chalk.cyan(instance._id)}`);

      console.log("");
      console.log(JSON.stringify(instance.toJSON(), null, 2));
    }),
  );
