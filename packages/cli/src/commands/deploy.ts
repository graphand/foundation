import chalk from "chalk";
import { Command } from "commander";
import { checksumDirectory, getClient, withSpinner } from "@/lib/utils.js";
import path from "path";
import fs from "fs";
import { Function, ModelInstance, ModelJSON } from "@graphand/core";
import { Client } from "@graphand/client";
import JobHandler from "@/lib/JobHandler.js";
import Collector from "@/lib/Collector.js";

export const commandDeploy = new Command("deploy")
  .description("Deploy a function")
  .arguments("<functionName> <functionPath>")
  .option("--set <set>", "Set fields with URL encoded key=value (field1=value1&field2=value2)", Collector.setter)
  .option("-f --force", "Force deployment")
  .action(async (functionName, functionPath, options) => {
    let func: ModelInstance<typeof Function> | null | undefined;
    let updated = false;
    let client: Client;

    await withSpinner(
      async spinner => {
        client = await getClient({ realtime: true });

        const model = client.getModel(Function);

        if (!fs.existsSync(path.resolve(functionPath))) {
          throw new Error(`Function path ${functionPath} does not exist`);
        }

        console.info(`Retrieving function ${functionName} ...`);

        func = await model.get(functionName).catch(() => null);

        let payload: ModelJSON<typeof Function>;

        if (Array.isArray(options.set)) {
          payload = options.set[0] as ModelJSON<typeof Function>;
        } else {
          payload = options.set as ModelJSON<typeof Function>;
        }

        payload ??= {};

        Object.assign(payload, {
          name: payload.name ?? functionName,
          exposed: payload.exposed ?? true,
          runtime: payload.runtime ?? "deno",
        });

        const checksum = await checksumDirectory(functionPath);

        if (func?._checksum === checksum && !options.force) {
          spinner.succeed(
            `Function ${functionName} already deployed and code is up to date. Use --force to deploy anyway`,
          );
          return;
        }

        const formData = new FormData();
        const zip = await Collector.decodeZip(functionPath);
        formData.append("file", zip, "function.zip");

        if (func) {
          console.info(`Updating function ${functionName} ...`);

          await func.update({ $set: payload }, { formData });

          spinner.succeed(`Updated function ${functionName} successfully`);

          updated = true;
          return;
        } else {
          console.info(`Creating function ${functionName} ...`);

          func = await model.create(payload, { formData });

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
      const jobHandler = new JobHandler(jobId, {
        client,
        onFail: job => {
          const err = String(job._result?.error ?? "Unknown error");
          throw new Error(`Deployment job failed with error: ${chalk.bold(err)}`);
        },
        spin: {
          spinner,
          message: `Deployment job is active ...`,
          messageSuccess: `Deployment job finished successfully. Function ${func?._id} is now ready!`,
          messageFail: "",
        },
      });

      await jobHandler.wait();
    });
  });
