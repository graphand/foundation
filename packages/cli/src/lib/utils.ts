import qs from "qs";
import chalk from "chalk";
import { UserConfig } from "@/types";
import path from "node:path";
import fs from "node:fs";
import Conf from "conf";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { program } from "commander";
import { Client, ModuleConstructor, ClientModules, ClientOptions } from "@graphand/client";
import { ModuleAuth } from "@graphand/client-module-auth";
import { ModuleRealtime } from "@graphand/client-module-realtime";
import open from "open";
import ModuleCli from "./ModuleCli";
import ora, { Ora } from "ora";
import { controllerJobLogs, Job, JobStatus, ModelInstance } from "@graphand/core";
import LogProcessor from "./LogProcessor";

export const createClient = <T extends ModuleConstructor[] = ModuleConstructor[]>(
  modules: ClientModules<T> = [] as ClientModules<T>,
  options: Partial<ClientOptions> = {},
): Client<T> => {
  options ??= {};
  options.endpoint ??= process.env.ENDPOINT;
  options.ssl ??= process.env.SSL !== "0";
  options.accessToken ??= process.env.ACCESS_TOKEN;
  options.project ??= process.env.PROJECT;
  options.headers ??= {};
  options.headers["X-Access-Key"] ??= process.env.ACCESS_KEY;
  return new Client(modules, options as ClientOptions);
};

export const defineConfig = (config: UserConfig): UserConfig => {
  return config;
};

export const loadConfigFile = (): string | null => {
  const { config } = program.opts() || {};
  if (config) {
    const configPath = path.resolve(config);
    if (fs.existsSync(configPath)) {
      return configPath;
    }

    return null;
  }

  try {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    if (packageJSON.graphand?.config) {
      return path.resolve(packageJSON.graphand.config);
    }
  } catch (e) {
    return null;
  }

  const configFiles = ["graphand.config.ts", "graphand.config.js", "graphand.config.mjs", "graphand.config.cjs"];

  for (const file of configFiles) {
    const configPath = path.join(process.cwd(), file);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
};

export const rmConfigFile = () => {
  const configPath = loadConfigFile();
  if (configPath) {
    fs.rmSync(configPath);
  }
};

export const loadConf = (project: string): Conf => {
  return new Conf({ projectName: `@graphand/cli:${project}` });
};

export const loadConfig = async (): Promise<UserConfig> => {
  const configPath = loadConfigFile();
  if (!configPath) {
    throw new Error("Configuration file not found. Run `graphand init` to create a configuration file");
  }

  let config: UserConfig;

  try {
    const configContent = await fs.promises.readFile(configPath, "utf8");

    const result = transformSync(configContent, {
      loader: path.extname(configPath) === ".ts" ? "ts" : "js",
      format: "esm",
      target: "es2020",
    });

    const transpiledCode = result.code;

    // Use dynamic import to load the transpiled code
    const tempFilePath = fileURLToPath(new URL(`file://${process.cwd()}/temp-config.mjs`));
    await fs.promises.writeFile(tempFilePath, transpiledCode);

    try {
      const importedConfig = await import(tempFilePath);

      if (importedConfig.default) {
        config = importedConfig.default as UserConfig;
      }
    } finally {
      // Ensure temp file is deleted even if an error occurs
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  } catch (error) {
    console.error("Error loading configuration:", error);
    throw new Error("Failed to load configuration file");
  }

  if (!config) {
    throw new Error("No valid configuration found in file");
  }

  if (!config.client?.project) {
    throw new Error("No project found in configuration (client.project is undefined)");
  }

  return config;
};

export const getClient = async (): Promise<Client<[typeof ModuleAuth, typeof ModuleRealtime, typeof ModuleCli]>> => {
  if (Client.getGlobal()) {
    return Client.getGlobal();
  }

  let spinnerText = globalThis.spinner?.text;
  if (globalThis.spinner) {
    globalThis.spinner.text = "Initializing client ...";
  }

  const config = await loadConfig();
  const configClient = (config.client || {}) as ClientOptions;
  const conf = loadConf(config.client.project);
  const client = new Client(
    [
      [
        ModuleAuth,
        {
          storage: {
            setItem: (key: string, value: string) => conf.set(key, value),
            getItem: (key: string) => conf.get(key) as string,
            removeItem: (key: string) => conf.delete(key),
          },
          handleRedirect: (url: string) => {
            console.log(chalk.green(`Opening ${url} in your browser...`));
            open(url);
          },
        },
      ],
      [ModuleRealtime, { transports: ["websocket"], handleConnectError: () => null }],
      [ModuleCli],
    ],
    { disableCache: true, ...configClient },
  );

  await client.init();

  if (globalThis.spinner && spinnerText) {
    globalThis.spinner.text = spinnerText;
  }

  globalThis.client ??= client;

  return client;
};

export const waitJob = async ({
  client,
  jobId,
  onChange,
  onSuccess,
  onFail,
  pollInterval,
  spin,
}: {
  client: Client;
  jobId: string;
  onChange?: (_job: ModelInstance<typeof Job>) => void;
  onSuccess?: (_job: ModelInstance<typeof Job>) => void;
  onFail?: (_job: ModelInstance<typeof Job>) => void;
  pollInterval?: number;
  spin?: {
    spinner: Ora;
    message?: string | ((_job: ModelInstance<typeof Job>) => string);
    messageSuccess?: string | ((_job: ModelInstance<typeof Job>) => string);
    messageFail?: string | ((_job: ModelInstance<typeof Job>) => string);
  };
}) => {
  const _getColorForJobStatus = (status: JobStatus): keyof typeof chalk => {
    switch (status) {
      case JobStatus.SUCCESS:
        return "green";
      case JobStatus.FAILED:
        return "red";
      default:
        return "cyan";
    }
  };

  const _fetch = async () => {
    const job = await client.getModel(Job).get(jobId);

    if (spin) {
      let message: string;
      if (spin?.message) {
        message = typeof spin.message === "function" ? spin.message(job) : spin.message;
      }
      message ??= `Job ${job._type} (${chalk.bold(job._id)}) is: ${chalk.keyword(_getColorForJobStatus(job._status))(job._status)} ...`;

      spin.spinner.text = message;
    }

    await onChange?.(job);

    return job;
  };

  let job: ModelInstance<typeof Job> = await _fetch();

  await _fetch();

  const stream = await client
    .execute(controllerJobLogs, {
      params: { id: jobId },
      query: { stream: "1" },
    })
    .then(r => r.body.getReader());

  const logsPromise = processLogs({ stream, spinner: spin.spinner, endAction: "end-job" });

  let unsubscribe: () => void;

  const endPromise = new Promise<void>(resolve => {
    unsubscribe = job.subscribe(() => {
      if ([JobStatus.SUCCESS, JobStatus.FAILED].includes(job._status)) {
        resolve();
      }
    });
  });

  let racePromise: Promise<void>;

  pollInterval ??= 3000;
  if (pollInterval) {
    const pollPromise = new Promise<void>(async (resolve, reject) => {
      try {
        while (![JobStatus.SUCCESS, JobStatus.FAILED].includes(job._status)) {
          job = await _fetch();
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });

    racePromise = Promise.race([endPromise, pollPromise]);
  } else {
    racePromise = endPromise;
  }

  await Promise.all([logsPromise, racePromise]);

  unsubscribe?.();

  if (job._status === JobStatus.FAILED) {
    if (spin) {
      let message: string;
      if (spin?.messageFail !== undefined) {
        message = typeof spin.messageFail === "function" ? spin.messageFail(job) : spin.messageFail;
      }
      message ??= `${chalk.keyword(_getColorForJobStatus(job._status))(job._status)}: Job ${job._type} (${chalk.bold(job._id)}) has failed with error: ${chalk.bold(String(job._result?.error ?? "Unknown error"))}`;

      if (message) {
        spin.spinner.fail(message);
      }
    }

    await onFail?.(job);
  }

  if (job._status === JobStatus.SUCCESS) {
    if (spin) {
      let message: string;
      if (spin?.messageSuccess !== undefined) {
        message = typeof spin.messageSuccess === "function" ? spin.messageSuccess(job) : spin.messageSuccess;
      }
      message ??= `${chalk.keyword(_getColorForJobStatus(job._status))(job._status)}: Job ${job._type} (${chalk.bold(job._id)}) has finished successfully`;

      if (message) {
        spin.spinner.succeed(message);
      }
    }

    await onSuccess?.(job);
  }

  return job;
};

export const withSpinner = async <T = any>(
  fn: (_spinner: Ora) => Promise<T> | T,
  opts?: {
    spinner?: Ora;
    start?: string;
    succeed?: string | ((_r: any) => string);
    fail?: string | ((_e: Error) => string);
    throw?: boolean;
    skipJobs?: boolean;
  },
): Promise<T> => {
  const spinner = globalThis.spinner || (opts?.spinner ?? ora(opts?.start ?? "Loading ...").start());
  globalThis.spinner = spinner;
  globalThis.jobs = [];

  const logs: Array<{ type: "log" | "table"; args: any[] }> = [];
  let e: Error | undefined;

  // Store original console methods
  const originalLog = console.log;
  const originalTable = console.table;

  // Override console methods to store logs
  console.log = (...args: any[]) => {
    if (!spinner.isSpinning) {
      originalLog(...args);
      return;
    }

    logs.push({ type: "log", args });
  };

  console.table = (...args: any[]) => {
    if (!spinner.isSpinning) {
      originalTable(...args);
      return;
    }

    logs.push({ type: "table", args });
  };

  try {
    const res = await fn(spinner);
    if (spinner.isSpinning) {
      const succeed = typeof opts?.succeed === "function" ? opts?.succeed(res) : opts?.succeed || "Success";
      spinner.succeed(succeed);
    }
    return res;
  } catch (_e) {
    e = _e as Error;
  } finally {
    if (e && spinner.isSpinning) {
      const fail = typeof opts?.fail === "function" ? opts?.fail(e) : opts?.fail || e.message;
      spinner.fail(fail);
    }

    delete globalThis.spinner;

    if (globalThis.jobs?.length && globalThis.client && !opts?.skipJobs) {
      for (const jobId of globalThis.jobs) {
        console.log("");

        const spinner = ora(`Waiting for job ${jobId} to finish...`).start();

        await waitJob({
          client: globalThis.client,
          jobId,
          spin: { spinner },
        });
      }
    }

    // Restore original console methods
    console.log = originalLog;
    console.table = originalTable;

    // Log all stored logs
    logs.forEach(({ type, args }) => {
      if (type === "log") {
        originalLog(...args);
      } else if (type === "table") {
        originalTable(...args);
      }
    });

    delete globalThis.jobs;
  }

  if (opts?.throw && e) {
    throw e;
  }
};

export const processLogs = async ({
  logs = [],
  stream,
  spinner,
  abortController,
  endAction,
}: {
  logs?: Array<string>;
  stream?: ReadableStreamDefaultReader<Uint8Array>;
  spinner?: Ora;
  abortController?: AbortController;
  endAction?: string;
}): Promise<void> => {
  const processor = new LogProcessor({ abortController, spinner, endAction });

  // Process initial logs
  if (logs?.length) {
    logs.forEach(processor.processLogEntry);
  }

  if (stream) {
    // Set up CTRL+C handler
    const _sigintHandler = () => {
      processor.abort();
      // Remove the handler to allow the process to exit
      process.off("SIGINT", _sigintHandler);
    };

    process.on("SIGINT", _sigintHandler);

    try {
      await processor.processStream(stream);
    } finally {
      // Ensure we remove the SIGINT listener
      process.off("SIGINT", _sigintHandler);
    }
  }
};

const decodeFileBase64 = (value: string) => {
  const filePath = path.resolve(String(value));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} not found`);
  }

  const fileContent = fs.readFileSync(filePath);
  const file = Buffer.from(fileContent);
  return file.toString("base64");
};

const decodeFileText = (value: string) => {
  const filePath = path.resolve(String(value));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} not found`);
  }

  const fileContent = fs.readFileSync(filePath);
  return fileContent.toString();
};

const decodeFile = (value: string) => {
  const filePath = path.resolve(String(value));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} not found`);
  }

  return fs.readFileSync(filePath);
};

export const collectSetter = (value: string, previous: object) => {
  const obj = qs.parse(value + "&" + qs.stringify(previous));
  const operators = ["fileBase64", "fileText", "file", "stdin"];
  return JSON.parse(JSON.stringify(obj), function (key, value) {
    if (new RegExp(`^@(${operators.join("|")}):`).test(value)) {
      const [type, v] = value.split(":");
      switch (type.replace("@", "")) {
        case "fileBase64":
          value = decodeFileBase64(v);
          break;
        case "fileText":
          value = decodeFileText(v);
          break;
        case "file":
          value = decodeFile(v);
          break;
        case "stdin":
          value = process.stdin.read();
          break;
        default:
          break;
      }
    }

    return value;
  });
};
