import chalk from "chalk";
import { getClient, loadGdx, withSpinner } from "@/lib/utils.js";
import { controllerGdxPush, JSONTypeObject } from "@graphand/core";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";

type GDXData = Record<string, { create: JSONTypeObject; update: JSONTypeObject; delete: JSONTypeObject }>;

export const commandGdxPush = new Command("push")
  .description("gdx push")
  .option("--clean", "Clean")
  .option("--force", "Force")
  .option("--skip-realtime-upload", "Skip realtime upload")
  .option("-v --verbose", "Verbose")
  .action(async options => {
    let data: GDXData | undefined;
    let body: RequestInit["body"];

    const client = await getClient({ realtime: true });

    const _getLines = (data: GDXData, confirm?: boolean) => {
      let lines = [];

      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("$")) {
          continue;
        }

        if (value.create && Object.keys(value.create).length) {
          const verb = confirm ? "created" : "creating";
          lines.push(`${verb} ${Object.keys(value.create).length} ${key}`);
        }

        if (value.update && Object.keys(value.update).length) {
          const verb = confirm ? "updated" : "updating";
          lines.push(`${verb} ${Object.keys(value.update).length} ${key}`);
        }

        if (value.delete && Object.keys(value.delete).length) {
          const verb = confirm ? "deleted" : "deleting";
          lines.push(`${verb} ${Object.keys(value.delete).length} ${key}`);
        }
      }

      return lines;
    };

    const _push = async (confirmChecksum?: string) => {
      let uploadId: string | undefined;
      let uploadResolve: (typeof Promise<void>)["resolve"] | undefined;

      if (!options.skipRealtimeUpload && body instanceof FormData) {
        await client.get("realtime").connect();

        uploadId = Math.random().toString(36).substring(7);

        const upload = client.get("realtime").getUpload(uploadId);
        let unsubscribe: () => void;
        new Promise<void>(resolve => {
          uploadResolve = resolve as (typeof Promise<void>)["resolve"];
          unsubscribe = upload.subscribe(async state => {
            console.info(`Uploading data ... ${state.percentage}%`);

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
          force: options.force,
          clean: options.clean,
          confirmChecksum,
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

      return resJSON.data as GDXData;
    };

    await withSpinner(async () => {
      const { json, file } = await loadGdx();
      let formData: FormData | undefined;

      if (file && Object.keys(file).length) {
        formData = new FormData();
        formData.append("_json", JSON.stringify(json));

        for (const [key, value] of Object.entries(file)) {
          formData?.append(key, await value);
        }

        body = formData;
      }

      body ??= JSON.stringify(json);

      data = await _push();

      if (options.verbose) {
        // This will log the data
        return data;
      }
    });

    if (!data) {
      return;
    }

    const lines = _getLines(data, options.force);

    if (!lines.length) {
      console.log(chalk.gray("Already up to date"));
      return;
    }

    if (!options.verbose) {
      console.log(chalk.gray("Use --verbose (-v) option to see the details"));
      console.log("");
    }

    lines.forEach(line => console.log(chalk.green(line)));

    if (options.force || !lines.length || !data.$checksum) {
      return;
    }

    const _confirm = await confirm({
      message: "Do you want to confirm the changes ?",
      default: false,
    });

    if (!_confirm) {
      return;
    }

    await withSpinner(async () => {
      // @ts-expect-error - $checksum is not typed here
      const confirmChecksum = data.$checksum as string;

      const res = await _push(confirmChecksum);

      if (options.verbose) {
        return res;
      }

      const lines = _getLines(res, true);

      lines.forEach(line => console.log(chalk.green(line)));
    });
  });
