import { Command } from "commander";
import { getClient } from "@/utils";
import ora from "ora";
import qs from "qs";
import { FetchError } from "@graphand/client";
import chalk from "chalk";
import {
  controllerCurrentAccount,
  controllerEntry,
  controllerModelCount,
  controllerModelCreate,
  controllerModelDelete,
  controllerModelQuery,
  controllerModelRead,
  controllerModelUpdate,
} from "@graphand/core";

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

export const commandExecute = new Command("execute")
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
