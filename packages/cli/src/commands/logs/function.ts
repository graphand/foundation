import { getClient, processLogs, withSpinner } from "@/lib/utils";
import { controllerFunctionLogs, Function } from "@graphand/core";
import { Command } from "commander";

export const commandLogsFunction = new Command("function")
  .alias("fn")
  .description("Get logs of a function")
  .arguments("<functionName>")
  .option("-s --stream", "Stream logs")
  .option("-p --pull", "Pull previous logs")
  .action(async (functionName, options) => {
    let logs: Array<string> = [];
    let stream: ReadableStreamDefaultReader<Uint8Array> | undefined;

    await withSpinner(async spinner => {
      const client = await getClient();

      const func = await client.getModel(Function).get(functionName);

      if (!func) {
        throw new Error(`Function ${functionName} not found`);
      }

      const query: Record<string, string> = {};

      if (options.pull) {
        query.pull = "1";
      }

      if (options.stream) {
        query.stream = "1";
      }

      const res = await client.execute(controllerFunctionLogs, {
        params: { id: func._id },
        query,
      });

      if (!res.ok) {
        throw new Error(`Failed to get logs for function ${functionName}: ${res.statusText}`);
      }

      if (options.stream) {
        stream = res.body.getReader();

        spinner.succeed(`Logs stream opened for function ${functionName}`);
      } else {
        const json = await res.json();
        logs = json.data as string[];

        spinner.succeed(`Found ${logs.length} logs for function ${functionName}`);
      }
    });

    if (logs.length || stream) {
      console.log("");
      await processLogs({ logs, stream });
    }
  });
