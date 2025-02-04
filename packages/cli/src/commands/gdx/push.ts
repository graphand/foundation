import chalk from "chalk";
import { getClient, loadGdx, withSpinner } from "@/lib/utils.js";
import { controllerGdxPush, JSONObject, ModelJSON } from "@graphand/core";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";

type GDXData = Record<string, { create: JSONObject; update: JSONObject; delete: JSONObject }>;

type GdxPushOptions = {
  clean: boolean;
  force: boolean;
  skipRealtimeUpload: boolean;
  ignoreProjectData: boolean;
  verbose: boolean;
  models: string;
};

export const commandGdxPush = new Command("push")
  .description("gdx push")
  .option("--clean", "Clean")
  .option("--force", "Force")
  .option("-m --models <models>", "List of models to push separated by comma")
  .option("--skip-realtime-upload", "Skip realtime upload")
  .option("--ignore-project-data", "Ignore project data. All data on project-scope models will be ignored")
  .option("-v --verbose", "Verbose")
  .action(async (options: GdxPushOptions) => {
    let data: GDXData | undefined;

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

    const _push = async (
      input: { json: JSONObject; file?: Record<string, Promise<File>> },
      confirmChecksum?: string,
    ) => {
      let uploadId: string | undefined;
      let uploadResolve: (typeof Promise<void>)["resolve"] | undefined;
      let body: RequestInit["body"];
      let formData: FormData | undefined;

      if (input.file && Object.keys(input.file).length) {
        formData = new FormData();
        formData.append("_json", JSON.stringify(input.json));

        for (const [key, value] of Object.entries(input.file)) {
          formData?.append(key, await value);
        }

        body = formData;
      }

      body ??= JSON.stringify(input.json);

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

    const models = options.models ? options.models.split(",").filter(Boolean) : undefined;
    const { json, file } = await loadGdx({ ignoreProjectData: options.ignoreProjectData, client, models });

    await withSpinner(async () => {
      data = await _push({ json, file });

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
      let confirmChecksum: string | undefined;

      if (data?.$checksum) {
        confirmChecksum = data.$checksum as unknown as string;

        Object.keys(data).forEach(model => {
          if (!data || !data[model]) {
            return;
          }

          const { create } = data[model]!;

          if (!create) {
            return;
          }

          Object.keys(create).forEach(key => {
            const created = create[key] as ModelJSON;
            const createdId = created?._id;

            if (!createdId) {
              return;
            }

            // @ts-ignore
            const obj = json[model][key];

            if (obj) {
              obj._id = createdId;
            }
          });
        });
      }

      const res = await _push({ json, file }, confirmChecksum);

      if (options.verbose) {
        return res;
      }

      const lines = _getLines(res, true);

      lines.forEach(line => console.log(chalk.green(line)));
    });
  });
