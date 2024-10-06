import { Command } from "commander";
import { colorizeJson, getClient, withSpinner } from "@/lib/utils.js";
import qs from "qs";
import { FetchError } from "@graphand/client";
import chalk from "chalk";
import {
  controllerCurrentAccount,
  controllerEntry,
  controllerFunctionRun,
  controllerModelCount,
  controllerModelCreate,
  controllerModelDelete,
  controllerModelQuery,
  controllerModelRead,
  controllerModelUpdate,
  controllerSubscriptionsCurrent,
  controllerJobLogs,
  controllerFunctionLogs,
  controllerGenTokenToken,
  controllerSnapshotsRestore,
  controllerSubscriptionsPortal,
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
  functionRun: controllerFunctionRun,
  subscriptionsCurrent: controllerSubscriptionsCurrent,
  subscriptionsPortal: controllerSubscriptionsPortal,
  jobLogs: controllerJobLogs,
  functionLogs: controllerFunctionLogs,
  genTokenToken: controllerGenTokenToken,
  snapshotRestore: controllerSnapshotsRestore,
};

export const commandExecute = new Command("execute")
  .alias("exec")
  .alias("e")
  .arguments("<controllerName>")
  .option("-p --params <params>", "URL encoded params options")
  .option("-q --query <query>", "URL encoded query options")
  .option("-d --data <data>", "URL encoded data options")
  .description("Execute a Graphand API endpoint")
  .action(async (controllerName, options) => {
    await withSpinner(async spinner => {
      if (!controllerName) {
        throw new Error("Controller name is required");
      }

      const controller = controllers[controllerName as keyof typeof controllers];

      if (!controller) {
        throw new Error(`Controller ${controllerName} not found`);
      }

      const startAt = Date.now();

      const client = await getClient({ realtime: true });

      const _handleRes = async (res: Response) => {
        const endAt = Date.now();
        const duration = endAt - startAt;

        const message = `Fetched ${chalk.cyan(controllerName)} in ${duration}ms with status ${res.status}`;

        if (res.ok) {
          spinner.succeed(message);

          const json = await res.json();

          if (!json.data) {
            return;
          }

          console.log("");
          console.log(colorizeJson(json.data));
        } else {
          spinner.fail(message);
        }
      };

      spinner.text = `Fetching ${controllerName} ...`;

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
          await _handleRes(e.res as Response);
        } else {
          throw new Error(`Failed to execute ${chalk.cyan(controllerName)}: ${(e as Error).message}`);
        }

        console.log("");
        console.log(JSON.stringify(e, null, 2));
      }
    });
  });
