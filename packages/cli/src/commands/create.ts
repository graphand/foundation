import { Command } from "commander";
import { getClient } from "@/utils";

export const commandCreate = new Command("create")
  .alias("new")
  .description("Create a new instance")
  .arguments("<modelName>")
  .action(async modelName => {
    const client = await getClient();
    const model = client.getModel(String(modelName));

    await model.initialize();

    console.log(model.slug);

    // for (const field of model.fieldsMap.values()) {
    //   if (field.path.startsWith("_")) {
    //     continue;
    //   }

    //   if (
    //     [
    //       FieldTypes.TEXT,
    //       FieldTypes.NUMBER,
    //       FieldTypes.ID,
    //       FieldTypes.IDENTITY,
    //       FieldTypes.RELATION,
    //       FieldTypes.NESTED,
    //       FieldTypes.ARRAY,
    //     ].includes(field.type)
    //   ) {
    //     let value: any = await input({
    //       message: chalk.yellow(field.path),
    //     });

    //     if (field.type === FieldTypes.NUMBER) {
    //       value = Number(value);
    //     }

    //     if (field.type === FieldTypes.NESTED) {
    //       value = value ? JSON.parse(value) : undefined;
    //     }

    //     data[field.path as keyof ModelJSON<typeof model>] = value;
    //   }
    // }

    // const spinner = ora(`Creating ${chalk.cyan(model.slug)}...`).start();

    // const instance = await model.create(data);

    // spinner.succeed(`Created ${chalk.cyan(model.slug)} successfully`);

    // console.log("");
    // console.log(JSON.stringify(instance.toJSON(), null, 2));
  });
