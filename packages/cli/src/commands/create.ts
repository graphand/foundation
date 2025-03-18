import chalk from "chalk";
import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { ModelInstance, ModelJSON } from "@graphand/core";
import { Ora } from "ora";
import Collector from "@/lib/Collector.js";

export const _create = async (options: {
  modelName: string;
  client?: Awaited<ReturnType<typeof getClient>>;
  set?: ReturnType<typeof Collector.setter>;
  file?: ReturnType<typeof Collector.file>;
  multiple?: boolean;
  formData?: boolean;
  spinner: Ora;
  skipRealtimeUpload?: boolean;
}) => {
  const useFormData = options.formData ?? !!options.file;
  const isMultiple = options.multiple ?? Boolean(Array.isArray(options.set));
  const skipRealtimeUpload = options.skipRealtimeUpload ?? false;

  const client = options.client ?? (await getClient({ realtime: true }));
  const model = client.model(String(options.modelName));

  options.spinner.text = `Initializing model ${model.configuration.slug} ...`;

  await model.initialize();

  options.spinner.text = `Creating ${chalk.cyan(model.configuration.slug)} instance...`;

  let formData: FormData | undefined;
  let uploadId: string | undefined;
  let uploadPromise: Promise<void> | undefined;

  if (useFormData) {
    formData = new FormData();
    if (options.file) {
      for (const [key, value] of Object.entries(options.file)) {
        formData?.append(key, await value);
      }
    }

    if (!skipRealtimeUpload) {
      uploadId = Math.random().toString(36).substring(7);

      const upload = client.get("realtime").getUpload(uploadId);
      let unsubscribe: () => void;
      uploadPromise = new Promise<void>(resolve => {
        unsubscribe = upload.subscribe(async state => {
          options.spinner.text = `Uploading ${chalk.cyan(model.configuration.slug)} ... ${state.percentage}%`;

          if (!["uploading", "pending"].includes(state.status)) {
            resolve();
          }
        });
      }).finally(() => {
        unsubscribe();
      });
    }
  }

  if (isMultiple) {
    let payload: Array<ModelJSON<typeof model>>;
    if (Array.isArray(options.set)) {
      payload = options.set as Array<ModelJSON<typeof model>>;
    } else {
      payload = [options.set] as Array<ModelJSON<typeof model>>;
    }

    if (spinner) {
      spinner.text = `Creating ${chalk.cyan(model.configuration.slug)} instances...`;
    }

    let instances: Array<ModelInstance<typeof model>> | undefined;

    const createPromise = model.createMultiple(payload, { formData, uploadId }).then(i => (instances = i));

    await Promise.race([uploadPromise, createPromise]);

    if (!instances) {
      await createPromise;
    }

    spinner?.succeed(`Created ${instances?.length} ${chalk.cyan(model.configuration.slug)} instances successfully`);

    return instances?.map(i => i.toJSON()) as Array<ModelJSON<typeof model>>;
  }

  let payload: ModelJSON<typeof model>;
  if (Array.isArray(options.set)) {
    payload = options.set[0] as ModelJSON<typeof model>;
  } else {
    payload = options.set as ModelJSON<typeof model>;
  }

  let instance: ModelInstance<typeof model> | undefined;

  const createPromise = model.create(payload, { formData, uploadId }).then(i => (instance = i));

  await Promise.race([uploadPromise, createPromise]);

  if (!instance) {
    await createPromise;
  }

  options.spinner.succeed(`Created a ${chalk.cyan(model.configuration.slug)} instance successfully`);

  return instance?.toJSON() as ModelJSON<typeof model>;
};

export const commandCreate = new Command("create")
  .alias("new")
  .description("Create a new instance")
  .arguments("<modelName>")
  .option(
    "--set <set>",
    "Set properties with URL encoded key=value (property1=value1&property2=value2)",
    Collector.setter,
  )
  .option("-f --file <file>", "File path to add", Collector.file)
  .option("-m --multiple", "Create multiple instances")
  .option("--skip-realtime-upload", "Skip realtime upload")
  .option("--form-data", "Use form data instead of JSON body. Default true if file is provided")
  .action(async (modelName, options) => {
    await withSpinner(spinner => _create({ modelName, spinner, ...options }));
  });
