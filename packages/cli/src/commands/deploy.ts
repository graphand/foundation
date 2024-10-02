import chalk from "chalk";
import { Command } from "commander";
import { collectSetter, getClient, waitJob, withSpinner } from "@/lib/utils.js";
import path from "path";
import fs from "fs";
import { Function, ModelInstance, ModelJSON } from "@graphand/core";
import { Client } from "@graphand/client";

export const commandDeploy = new Command("deploy")
  .description("Deploy a function")
  .arguments("<functionName> <codePath>")
  .option("--set <set>", "Set fields with URL encoded key=value (field1=value1&field2=value2)", collectSetter)
  .option("-f --force", "Force deployment")
  .action(async (functionName, codePath, options) => {
    let func: ModelInstance<typeof Function> | null | undefined;
    let updated = false;
    let client: Client;

    await withSpinner(
      async spinner => {
        client = await getClient({ realtime: true });

        const model = client.getModel(Function);

        const codeFile = path.resolve(codePath);

        if (!fs.existsSync(codeFile)) {
          throw new Error(`Code file ${codeFile} does not exist`);
        }

        const codeBuffer = fs.readFileSync(codeFile);
        const code = codeBuffer.toString("base64");

        spinner.text = `Retrieving function ${functionName} ...`;

        func = await model.get(functionName).catch(() => null);

        let payload: ModelJSON<typeof Function>;

        if (Array.isArray(options.set)) {
          payload = options.set[0] as ModelJSON<typeof Function>;
        } else {
          payload = options.set as ModelJSON<typeof Function>;
        }

        payload ??= {};

        payload.name = functionName;
        payload.code = code;
        payload.exposed ??= true;

        if (func) {
          if (func.code === code && !options.force) {
            spinner.succeed(
              `Function ${functionName} already deployed and code is up to date. Use --force to deploy anyway`,
            );
            return;
          }

          spinner.text = `Updating function ${functionName} ...`;

          await func.update({ $set: payload });

          spinner.succeed(`Updated function ${functionName} successfully`);

          updated = true;
          return;
        } else {
          spinner.text = `Creating function ${functionName} ...`;

          func = await model.create(payload);

          spinner.succeed(`Created function ${functionName} successfully with _id ${chalk.cyan(func._id)}`);

          updated = true;
          return;
        }
      },
      { skipJobs: true },
    );

    if (!func || !updated) {
      return;
    }

    console.log("");

    const jobId = func.get("_job", "json") as string;
    await withSpinner(async spinner => {
      await waitJob({
        client,
        jobId,
        onFail: job => {
          const err = String(job._result?.error ?? "Unknown error");
          throw new Error(`Deployment job failed with error: ${chalk.bold(err)}`);
        },
        spin: {
          spinner,
          message: `Deployment job is running ...`,
          messageSuccess: `Deployment job finished successfully. Function ${func?._id} is now ready!`,
          messageFail: "",
        },
      });
    });
  });
