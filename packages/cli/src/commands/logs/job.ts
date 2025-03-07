import { getClient, processLogs, withSpinner } from "@/lib/utils.js";
import { controllerJobLogs, Job } from "@graphand/core";
import { Command } from "commander";

export const commandLogsJob = new Command("job")
  .description("Get logs of a job")
  .arguments("<id>")
  .option("-s --stream", "Stream logs")
  .option("-p --pull", "Pull previous logs")
  .action(async (id, options) => {
    let logs: Array<string> = [];
    let stream: ReadableStreamDefaultReader<Uint8Array> | undefined;

    await withSpinner(async spinner => {
      const client = await getClient();

      const job = await client.model(Job).get(id);

      if (!job) {
        throw new Error(`Job ${id} not found`);
      }

      const query: Record<string, string> = {};

      if (options.pull) {
        query.pull = "1";
      }

      if (options.stream) {
        query.stream = "1";
      }

      const res = await client.execute(controllerJobLogs, {
        params: { id: job._id as string },
        query,
      });

      if (!res.ok) {
        throw new Error(`Failed to get logs for job ${id}: ${res.statusText}`);
      }

      if (options.stream) {
        stream = res.body?.getReader();

        spinner.succeed(`Logs stream opened for job ${id} (${job._type})`);
      } else {
        const json = await res.json();
        logs = json.data as string[];

        spinner.succeed(`Found ${logs.length} logs for job ${id} (${job._type})`);
      }
    });

    if (logs.length || stream) {
      console.log("");
      await processLogs({ logs, stream, endAction: "end-job" });
    }
  });
