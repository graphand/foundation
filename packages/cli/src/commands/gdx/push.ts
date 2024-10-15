import chalk from "chalk";
import { getClient, loadGdx, withSpinner } from "@/lib/utils.js";
import { controllerGdxPush, JSONTypeObject } from "@graphand/core";
import { Command } from "commander";

export const commandGdxPush = new Command("push")
  .description("gdx push")
  .option("--clean", "Clean")
  .option("--confirm", "Confirm")
  .option("--skip-realtime-upload", "Skip realtime upload")
  .option("-v --verbose", "Verbose")
  .action(async options => {
    await withSpinner(async spinner => {
      const { json, file } = await loadGdx();

      const client = await getClient({ realtime: true });

      let formData: FormData | undefined;
      let uploadId: string | undefined;
      let uploadResolve: (typeof Promise<void>)["resolve"] | undefined;
      let body: RequestInit["body"];

      if (file && Object.keys(file).length) {
        formData = new FormData();
        formData.append("_json", JSON.stringify(json));
        Object.entries(file).forEach(([key, value]) => formData?.append(key, value));
        body = formData;
      }

      body ??= JSON.stringify(json);

      if (!options.skipRealtimeUpload) {
        uploadId = Math.random().toString(36).substring(7);

        const upload = client.get("realtime").getUpload(uploadId);
        let unsubscribe: () => void;
        new Promise<void>(resolve => {
          uploadResolve = resolve as (typeof Promise<void>)["resolve"];
          unsubscribe = upload.subscribe(async state => {
            spinner.text = `Uploading data ... ${state.percentage}%`;

            if (!["uploading", "pending"].includes(state.status)) {
              resolve();
            }
          });
        }).finally(() => {
          unsubscribe();
        });
      }

      const res = await client.execute(controllerGdxPush, {
        query: {
          confirm: options.confirm,
          clean: options.clean,
        },
        init: {
          body,
          headers: {
            "Upload-Id": uploadId || "",
          },
        },
      });

      uploadResolve?.();

      const resJSON = await res.json();

      if (options.verbose) {
        return resJSON.data;
      }

      const data: Record<string, { create: JSONTypeObject; update: JSONTypeObject; delete: JSONTypeObject }> =
        resJSON.data;

      let lines = [];

      for (const [key, value] of Object.entries(data)) {
        if (value.create && Object.keys(value.create).length) {
          const verb = options.confirm ? "created" : "creating";
          lines.push(`${verb} ${Object.keys(value.create).length} ${key}`);
        }

        if (value.update && Object.keys(value.update).length) {
          const verb = options.confirm ? "updated" : "updating";
          lines.push(`${verb} ${Object.keys(value.update).length} ${key}`);
        }

        if (value.delete && Object.keys(value.delete).length) {
          const verb = options.confirm ? "deleted" : "deleting";
          lines.push(`${verb} ${Object.keys(value.delete).length} ${key}`);
        }
      }

      if (!lines.length) {
        console.log(chalk.gray("Already up to date"));
        return;
      }

      console.log(chalk.gray("Use --verbose (-v) option to see the details"));
      console.log("");

      lines.forEach(line => console.log(chalk.green(line)));
    });
  });
