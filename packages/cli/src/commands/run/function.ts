import chalk from "chalk";
import { colorizeJson, getClient, withSpinner } from "@/lib/utils.js";
import { controllerFunctionRun, Function, InferControllerInput } from "@graphand/core";
import { Command } from "commander";
import qs from "qs";
import { FetchError } from "@graphand/client";

export const commandRunFunction = new Command("function")
  .alias("fn")
  .description("Run a function")
  .arguments("<functionName>")
  .option("-p --params <params>", "URL encoded params options")
  .option("-q --query <query>", "URL encoded query options")
  .option("-d --data <data>", "URL encoded data options")
  .option("-run-in-job", "Run the function in a job")
  .action(async (functionName, options) => {
    await withSpinner(async spinner => {
      const client = await getClient();

      const func = await client.model(Function).get(functionName);

      if (!func) {
        throw new Error(`Function ${functionName} not found`);
      }

      const startAt = Date.now();

      const _handleRes = async (res: Response) => {
        const endAt = Date.now();
        const duration = endAt - startAt;

        const message = `Executed function ${chalk.cyan(func.name)} in ${duration}ms with status ${res.status}`;

        if (!res.ok) {
          spinner.fail(message);
          return;
        }

        spinner.succeed(message);

        const contentType = res.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          const json = await res.json();
          console.log("");
          console.log(colorizeJson(json));
          return;
        }

        if (contentType?.includes("text/plain")) {
          const text = await res.text();
          console.log("");
          console.log(text);
          return;
        }

        console.warn(`Unknown content type ${contentType}`);
      };

      console.info(`Executing function ${chalk.cyan(func.name)} (${chalk.bold(func._id)}) ...`);

      const params = options.params ? (qs.parse(options.params) as Record<string, string>) : undefined;

      try {
        const r = await client.execute(controllerFunctionRun, {
          params: Object.assign({}, params, { id: func._id }) as NonNullable<
            InferControllerInput<typeof controllerFunctionRun>
          >["params"],
          query: options.query ? (qs.parse(options.query) as Record<string, string>) : undefined,
          init: {
            body: options.data ? JSON.stringify(qs.parse(options.data)) : undefined,
          },
        });

        await _handleRes(r);
      } catch (e) {
        if (e instanceof FetchError) {
          await _handleRes(e.res as Response);
        } else {
          throw new Error(`Failed to execute function ${func.name}: ${(e as Error).message}`);
        }

        return JSON.stringify(e, null, 2);
      }
    });
  });
