import qs from "qs";
import chalk from "chalk";
import { UserConfig } from "@/types.js";
import path from "path";
import fs from "fs";
import Conf from "conf";
import { transformSync } from "esbuild";
import { program } from "commander";
import { Client, ClientModules, ClientOptions } from "@graphand/client";
import { ModuleAuth } from "@graphand/client-module-auth";
import { ModuleRealtime } from "@graphand/client-module-realtime";
import open from "open";
import ModuleCli from "./ModuleCli.js";
import ora, { Ora } from "ora";
import Table from "cli-table3";
import {
  AuthMethods,
  controllerJobLogs,
  Function,
  isObjectId,
  Job,
  JobStatus,
  JSONSubtypeArray,
  JSONType,
  JSONTypeObject,
  ModelInstance,
  ModelJSON,
} from "@graphand/core";
import LogProcessor from "./LogProcessor.js";
import mime from "mime";
import archiver from "archiver";
import { ReadableStream } from "stream/web";
import crypto from "crypto";

export const defineConfig = (config: UserConfig): UserConfig => {
  return config;
};

export const getConfigPath = (): string | null => {
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

  const configFiles = [
    "graphand.config.ts",
    "graphand.config.js",
    "graphand.config.mjs",
    "graphand.config.cjs",
    "graphand.config.json",
  ];

  for (const file of configFiles) {
    const configPath = path.join(process.cwd(), file);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
};

export const rmConfigFile = () => {
  const configPath = getConfigPath();
  if (configPath) {
    fs.rmSync(configPath);
  }
};

export const loadConf = (project: string): Conf => {
  return new Conf({ projectName: `@graphand/cli:${project}` });
};

export const loadConfig = async (): Promise<UserConfig> => {
  const configPath = getConfigPath();
  if (!configPath) {
    throw new Error("Configuration file not found. Run `graphand init` to create a configuration file");
  }

  let config: UserConfig | undefined;

  try {
    const configContent = await fs.promises.readFile(configPath, "utf8");

    if (path.extname(configPath) === ".json") {
      config = JSON.parse(configContent);
      return config as UserConfig;
    }

    const result = transformSync(configContent, {
      loader: path.extname(configPath) === ".ts" ? "ts" : "js",
      format: "esm",
      target: "es2020",
    });

    const transpiledCode = result.code;

    // Use dynamic import to load the transpiled code
    const tempFileName = "." + Date.now() + ".config.mjs";
    const tempFilePath = path.join(process.cwd(), tempFileName);
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

export const getGdxPath = async (): Promise<string | null> => {
  const config = await loadConfig();

  if (config.gdx?.path) {
    const configPath = path.join(process.cwd(), config.gdx.path);
    if (!fs.existsSync(configPath)) {
      throw new Error(`GDX file ${configPath} not found`);
    }
  }

  const gdxFiles = ["graphand.gdx.ts", "graphand.gdx.js", "graphand.gdx.json"];

  for (const file of gdxFiles) {
    const configPath = path.join(process.cwd(), file);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
};

export const loadGdx = async (): Promise<{ json: JSONTypeObject; file: Record<string, Promise<File>> | undefined }> => {
  const configPath = await getGdxPath();
  if (!configPath) {
    throw new Error("No gdx file found");
  }

  const configContent = await fs.promises.readFile(configPath, "utf8");

  let json: JSONTypeObject | undefined;
  let file: Record<string, Promise<File>> | undefined;

  if (path.extname(configPath) === ".json") {
    json = JSON.parse(configContent);
  } else {
    const result = transformSync(configContent, {
      loader: path.extname(configPath) === ".ts" ? "ts" : "js",
      format: "esm",
      target: "es2020",
    });

    const transpiledCode = result.code;

    // Use dynamic import to load the transpiled code

    const tempFileName = "." + Date.now() + ".gdx.mjs";
    const tempFilePath = path.join(process.cwd(), tempFileName);
    await fs.promises.writeFile(tempFilePath, transpiledCode);

    try {
      // Load the transpiled code
      const importedConfig = await import(tempFilePath);

      if (importedConfig.default) {
        json = importedConfig.default as JSONTypeObject;
      }
    } finally {
      // Ensure temp file is deleted even if an error occurs
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }

  if (json && "$cli.set" in json && Object.keys(json["$cli.set"] as object).length) {
    const set = json["$cli.set"] as JSONTypeObject;
    const assign = Object.entries(set).reduce((acc, [key, value]) => collectSetter(`${key}=${value}`, acc), {});

    mergeDeep(json, assign);
  }

  if (json && "$cli.file" in json && Object.keys(json["$cli.file"] as object).length) {
    const _file = json["$cli.file"] as JSONTypeObject;
    file = Object.entries(_file).reduce((acc, [key, value]) => collectFiles(`${key}=${value}`, acc), {});

    const assign = Object.entries(_file).reduce((acc, [key]) => collectSetter(key, acc), {});

    mergeDeep(json, assign);
  }

  if (json && "$cli.function" in json && Object.keys(json["$cli.function"] as object).length) {
    const _functions = json["$cli.function"] as Record<string, string>;
    const client = await getClient();
    json.functions ??= {};
    const functions = json.functions as Record<string, ModelJSON<typeof Function>>;
    for (const [key, value] of Object.entries(_functions)) {
      functions[key] ??= {};
      functions[key].exposed ??= true;
      functions[key].runtime ??= "deno";

      const functionPath = path.join(process.cwd(), value);
      const checksum = await checksumDirectory(functionPath);
      const func = await client
        .getModel(Function)
        .get(key)
        .catch(() => null);

      const bind = func ? func._checksum !== checksum : true;

      if (bind) {
        const zip = await decodeZip(value);
        file ??= {};
        file[`functions[${key}][file]`] = Promise.resolve(zip);
        // @ts-ignore
        functions[key].$force = true;
      }
    }
  }

  if (!json) {
    throw new Error("Failed to load gdx file");
  }

  delete json["$cli.set"];
  delete json["$cli.file"];
  delete json["$cli.function"];

  return { json, file };
};

export const getClient = async ({ realtime }: { realtime?: boolean } = {}): Promise<
  Client<[typeof ModuleAuth, typeof ModuleCli, typeof ModuleRealtime]>
> => {
  let spinnerText = globalThis.spinner?.text;
  if (globalThis.spinner) {
    globalThis.spinner.text = "Initializing client ...";
  }

  const config: UserConfig = globalThis.userConfig ?? (await loadConfig());
  const configClient = (config.client || {}) as ClientOptions;
  const conf = loadConf(configClient.project || "");

  // @ts-ignore
  const modules: ClientModules<[typeof ModuleAuth, typeof ModuleCli, typeof ModuleRealtime]> = [
    [
      ModuleAuth,
      {
        storage: {
          setItem: (key: string, value: string) => conf.set(key, value),
          getItem: (key: string) => conf.get(key) as string,
          removeItem: (key: string) => conf.delete(key),
        },
        handleCallback: {
          [AuthMethods.CODE]: async url => {
            const _url = url.toString();
            console.log(chalk.green(`Opening ${_url} in your browser...`));
            open(_url);
          },
          [AuthMethods.REDIRECT]: () => {
            throw new Error(`Method redirect is not supported with CLI. Use ${AuthMethods.CODE} instead`);
          },
          [AuthMethods.WINDOW]: () => {
            throw new Error(`Method window is not supported with CLI. Use ${AuthMethods.CODE} instead`);
          },
        },
      },
    ],
    [ModuleCli],
  ];

  if (realtime) {
    const handleConnectError = async (error: Error) => {
      if (error.message.includes("expired")) {
        await client.get("auth").refreshToken();
        await client.get("realtime").connect(true);
        return;
      }

      console.error("Unable to connect socket", error.message);
    };

    modules.push([
      ModuleRealtime,
      {
        transports: ["websocket"],
        handleConnectError: handleConnectError,
      },
    ]);
  }

  const client = new Client(modules, { disableCache: true, ...configClient });

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
  const _getColorForJobStatus = (status: JobStatus) => {
    switch (status) {
      case JobStatus.COMPLETED:
        return "green";
      case JobStatus.FAILED:
        return "red";
      default:
        return "cyan";
    }
  };

  const _handleJob = async (job: ModelInstance<typeof Job>) => {
    if (spin) {
      let message: string;
      if (spin?.message) {
        message = typeof spin.message === "function" ? spin.message(job) : spin.message;
      }
      message ??= `Job ${job._type} (${chalk.bold(job._id)}) is: ${chalk[_getColorForJobStatus(job._status || JobStatus.FAILED)](job._status || "unknown")} ...`;

      spin.spinner.text = message;
    }

    await onChange?.(job);
  };

  const _fetch = async () => {
    const job = await client
      .getModel(Job)
      .get(jobId)
      .catch(() => null);

    if (job) {
      await _handleJob(job);
    }

    return job;
  };

  let job: ModelInstance<typeof Job> = (await _fetch()) as ModelInstance<typeof Job>;

  if (!job) {
    throw new Error("Job not found");
  }

  job = job as ModelInstance<typeof Job>;

  await _fetch();

  const stream = await client
    .execute(controllerJobLogs, {
      params: { id: jobId },
      query: { stream: "1" },
    })
    .then(r => r.body?.getReader());

  const abortController = new AbortController();
  const logsPromise = processLogs({ stream, spinner: spin?.spinner, endAction: "end-job", abortController });

  let unsubscribe: undefined | (() => void);

  const endPromise = new Promise<void>(resolve => {
    unsubscribe = job.subscribe(() => {
      _handleJob(job);
      if (job._status && [JobStatus.COMPLETED, JobStatus.FAILED].includes(job._status)) {
        resolve();
      }
    });
  });

  let racePromise: Promise<void>;

  pollInterval ??= 2000;
  if (pollInterval) {
    const pollPromise = new Promise<void>(async (resolve, reject) => {
      try {
        while (job._status && ![JobStatus.COMPLETED, JobStatus.FAILED].includes(job._status)) {
          job = (await _fetch()) as ModelInstance<typeof Job>;
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

  await Promise.race([logsPromise, racePromise]);

  abortController.abort();

  unsubscribe?.();

  if (job._status === JobStatus.FAILED) {
    if (spin) {
      let message: string;
      if (spin?.messageFail !== undefined) {
        message = typeof spin.messageFail === "function" ? spin.messageFail(job) : spin.messageFail;
      }
      message ??= `${chalk[_getColorForJobStatus(job._status)](job._status)}: Job ${job._type} (${chalk.bold(job._id)}) has failed with error: ${chalk.bold(String(job._result?.error ?? "Unknown error"))}`;

      if (message) {
        spin.spinner.fail(message);
      }
    }

    await onFail?.(job);
  }

  if (job._status === JobStatus.COMPLETED) {
    if (spin) {
      let message: string;
      if (spin?.messageSuccess !== undefined) {
        message = typeof spin.messageSuccess === "function" ? spin.messageSuccess(job) : spin.messageSuccess;
      }
      message ??= `${chalk[_getColorForJobStatus(job._status)](job._status)}: Job ${job._type} (${chalk.bold(job._id)}) has finished successfully`;

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
): Promise<void> => {
  const spinner = globalThis.spinner || (opts?.spinner ?? ora(opts?.start ?? "Loading ...").start());
  globalThis.spinner = spinner;
  globalThis.jobs = [];

  const logs: Array<{ type: "log" | "table"; args: any[] }> = [];
  let e: Error | undefined;

  // Store original console methods
  const originalInfo = console.info;
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

  console.info = (...args: any[]) => {
    if (!spinner.isSpinning) {
      return;
    }

    spinner.text = args[0];
  };

  try {
    const res = await fn(spinner);
    if (spinner.isSpinning) {
      const succeed = typeof opts?.succeed === "function" ? opts?.succeed(res) : opts?.succeed || "Success";
      spinner.succeed(succeed);
    }

    if (res) {
      console.log("");

      if (typeof res === "object") {
        console.log(colorizeJson(res as JSONType));
      } else {
        console.log(res);
      }
    }
  } catch (_e) {
    e = _e as Error;
  } finally {
    if (e && spinner.isSpinning) {
      const fail = typeof opts?.fail === "function" ? opts?.fail(e) : opts?.fail || e.message;
      spinner.fail(fail);
    }

    delete globalThis.spinner;

    if (globalThis.jobs?.length && globalThis.client && !opts?.skipJobs) {
      for await (const jobId of globalThis.jobs) {
        console.log("");

        await withSpinner(
          async spinner => {
            await waitJob({
              client: globalThis.client as Client,
              jobId,
              spin: { spinner },
            });
          },
          { spinner: ora(`Waiting for job ${jobId} to finish...`).start() },
        );
      }
    }

    // Restore original console methods
    console.log = originalLog;
    console.table = originalTable;
    console.info = originalInfo;

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
      stream.cancel();
      // Remove the handler to allow the process to exit
      process.off("SIGINT", _sigintHandler);
      process.exit(0); // Force exit on SIGINT
    };

    process.once("SIGINT", _sigintHandler);

    try {
      await processor.processStream(stream);
    } finally {
      // Ensure we remove the SIGINT handler
      process.off("SIGINT", _sigintHandler);

      if (!stream.closed) {
        stream.cancel();
      }
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

const decodeFile = (value: string): Promise<File> => {
  const filePath = path.resolve(String(value));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} not found`);
  }

  const file = new File([fs.readFileSync(filePath)], path.basename(filePath), {
    type: mime.getType(filePath) ?? "application/octet-stream",
    lastModified: fs.statSync(filePath)?.mtime?.getTime(),
  });

  return Promise.resolve(file);
};

export const decodeZip = async (value: string): Promise<File> => {
  const functionDirectory = path.resolve(String(value));
  if (!fs.existsSync(functionDirectory)) {
    throw new Error(`Function directory ${functionDirectory} not found`);
  }

  // Creating a zip from the file
  const zip = archiver("zip");
  zip.directory(functionDirectory, false);
  await zip.finalize();

  const buffer = await ReadableStream.from(zip).getReader().read();

  return new File([buffer.value], "function.zip", {
    type: "application/zip",
    lastModified: Date.now(),
  });
};

export const calculateChecksum = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const getAllFilePaths = async (dir: string): Promise<string[]> => {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return await getAllFilePaths(fullPath);
      } else {
        return fullPath;
      }
    }),
  );

  return Array.prototype.concat(...files);
};

export const checksumDirectory = async (dir: string): Promise<string> => {
  const filePaths = await getAllFilePaths(dir);
  // Sort file paths to ensure consistent order
  filePaths.sort();

  const hash = crypto.createHash("md5");

  for await (const filePath of filePaths) {
    // Include the relative file path in the hash
    const relativePath = path.relative(dir, filePath);
    hash.update(relativePath);

    const fileData = await fs.promises.readFile(filePath);
    hash.update(fileData);
  }

  const digest = hash.digest("hex");
  return digest;
};

export const collectSetter = (
  value: string,
  previous?: JSONTypeObject | JSONSubtypeArray,
): JSONTypeObject | JSONSubtypeArray => {
  previous ??= {};

  if (Array.isArray(previous)) {
    previous = previous.reduce((acc, item, index) => {
      Object.assign(acc as JSONTypeObject, { [index]: item });
      return acc;
    }, {}) as JSONTypeObject;
  }

  const obj = qs.parse(value);

  mergeDeep(previous as any, obj);

  let result: JSONTypeObject | JSONSubtypeArray = previous;

  const keys = Object.keys(previous || {});
  if (keys.length && keys.every(isIntegerOrIntString)) {
    const set = [];
    for (const key of keys) {
      set[parseInt(key)] = previous[key as keyof typeof previous];
    }
    result = set as JSONSubtypeArray;
  }

  const _processValue = (value: string) => {
    const operators = ["fileBase64", "fileText", "stdin"];
    if (new RegExp(`^@(${operators.join("|")}):?`).test(value)) {
      const [type, v] = value.split(":");
      if (!type) throw new Error(`Invalid type ${value}`);

      switch (type.replace("@", "")) {
        case "fileBase64": {
          return decodeFileBase64(v || "");
        }
        case "fileText": {
          return decodeFileText(v || "");
        }
        case "stdin": {
          return process.stdin.read() || "";
        }
        default:
          break;
      }
    }

    return value;
  };

  return replaceAllStrings(result, _processValue);
};

export const collectFiles = (
  value: string,
  previous?: Record<string, Promise<File>>,
): Record<string, Promise<File>> => {
  let field: string;
  let path: string;

  if (value.includes("=")) {
    [field, path] = value.split("=") as [string, string];
  } else {
    field = "file";
    path = value;
  }

  const _getFile = (value: string): Promise<File> => {
    const types = ["zip", "file"];
    let type = "file";
    let v = value;

    if (new RegExp(`^@(${types.join("|")}):?`).test(value)) {
      [type, v] = value.replace(/^@/, "").split(":") as [string, string];
    }

    if (!type || !types.includes(type)) {
      throw new Error(`Invalid type ${type}`);
    }

    switch (type) {
      case "zip": {
        return decodeZip(v || "");
      }
      case "file":
      default: {
        return decodeFile(v || "");
      }
    }
  };

  previous ??= {};
  previous[field] = _getFile(path);

  return previous;
};

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export const isObject = (item: unknown) => {
  return item && typeof item === "object" && !Array.isArray(item);
};

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export const mergeDeep = <T extends Record<string, unknown>>(target: T, ...sources: T[]): T => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key] as T, source[key] as T);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
};

export const replaceAllValues = (obj: unknown, find: unknown, replace: unknown): unknown => {
  if (obj === find) {
    return replace;
  }

  if (Array.isArray(obj)) {
    return obj.map(v => replaceAllValues(v, find, replace));
  }

  const result: Record<string, unknown> = {};
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const _obj = obj as Record<string, unknown>;
      result[key] = replaceAllValues(_obj[key as keyof typeof _obj], find, replace);
    }
  }
  return result;
};

export const replaceAllStrings = <T>(input: T, replacer: (_str: string) => string): T => {
  if (typeof input === "string") {
    return replacer(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map(item => replaceAllStrings(item, replacer)) as unknown as T;
  }

  if (typeof input === "object" && input !== null) {
    const result: JSONTypeObject = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = replaceAllStrings(value, replacer);
    }
    return result as T;
  }

  return input;
};

export const isIntegerOrIntString = (value: unknown): boolean => {
  // Check if it's an integer
  if (Number.isInteger(value)) {
    return true;
  }

  // Check if it's a string representation of an integer
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return true;
  }

  return false;
};

export const colorizeJson = (obj: JSONType) => {
  const jsonString: string = JSON.stringify(obj, null, 2);

  try {
    // Parse the JSON string into an object
    const jsonObject = JSON.parse(jsonString);

    // Convert the object back to a string with indentation for better readability
    const formattedJson = JSON.stringify(jsonObject, null, 2);

    // Split the formatted JSON into lines
    const lines = formattedJson.split("\n");

    // Process each line and apply colors
    const colorizedLines = lines.map(line =>
      line
        // Colorize keys and strings
        .replace(/"([^"]+)"(:?)/g, (match, p1, p2) => {
          // Colorize keys
          if (p2) {
            return chalk.cyan(`"${p1}"`) + p2;
          }

          if (isObjectId(p1)) {
            return chalk.bold(`"${p1}"`) + p2;
          }

          let isDate: boolean;

          try {
            const date = new Date(p1);
            isDate = date instanceof Date && !isNaN(date.getTime());
          } catch (e) {
            isDate = false;
          }

          if (isDate) {
            return chalk.blue(`"${p1}"`);
          }

          return chalk.green(`"${p1}"`);
        })

        // Colorize numbers
        .replace(/: (-?\d*\.?\d+)/g, (match, p1) => {
          return `: ${chalk.yellow(p1)}`;
        })

        // Colorize booleans
        .replace(/: (true|false)/g, (match, p1) => {
          return `: ${chalk.magenta(p1)}`;
        })

        // Colorize null
        .replace(/: null/g, `: ${chalk.gray("null")}`),
    );

    // Join the colorized lines and log to console
    return colorizedLines.join("\n");
  } catch (error) {
    console.error(chalk.red("Error parsing JSON:"), error);
  }
};

/**
 * Checks if the current project has TypeScript enabled.
 * @returns {boolean} - Returns true if TypeScript is enabled, false otherwise.
 */
export const isTypescriptProject = () => {
  const startDir = process.cwd();

  // Helper function to find a file in the directory tree
  function findUp(filename: string, dir: string) {
    const root = path.parse(dir).root;
    let currentDir = dir;

    while (currentDir && currentDir !== root) {
      const filePath = path.join(currentDir, filename);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      currentDir = path.dirname(currentDir);
    }

    // Check the root directory as well
    const filePath = path.join(root, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  // Check for tsconfig.json
  const tsconfigPath = findUp("tsconfig.json", startDir);
  if (tsconfigPath) {
    return true;
  }

  // Check for TypeScript in package.json dependencies
  const packageJsonPath = findUp("package.json", startDir);
  if (packageJsonPath) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const deps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};
      if ("typescript" in deps || "typescript" in devDeps) {
        return true;
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }

  return false;
};

export const getTable = <Fields extends string[], Item extends any>(options: {
  fields: Fields;
  list: Array<Item>;
  getter: (_item: Item, _field: Fields[number]) => unknown;
  getNaturalWidth?: (_field: Fields[number]) => number;
  isImportantField?: (_field: Fields[number]) => boolean;
  maxWidth?: number;
}) => {
  const fields = options.fields;
  const list = options.list;
  const getter = options.getter;
  const getNaturalWidth = options.getNaturalWidth;
  const isImportantField = options.isImportantField;
  const maxWidth = Number(options.maxWidth || 70);

  // Calculate natural widths for each column based on maximum cell content width
  const naturalWidths = fields.map(field => {
    if (typeof getNaturalWidth === "function") {
      return getNaturalWidth(field);
    }

    const values = list.map(item => String(getter(item, field)));
    const maxContentWidth = Math.max(...values.map(value => value.length), field.length);
    return maxContentWidth;
  });

  // Copy naturalWidths for adjustment
  let columnWidths = [...naturalWidths];

  const totalNaturalWidth = naturalWidths.reduce((sum, width) => sum + width, 0);

  if (totalNaturalWidth > maxWidth) {
    // Calculate required width reduction
    const widthToReduce = totalNaturalWidth - maxWidth;

    // Column indices sorted by descending natural width
    const sortedIndices = naturalWidths
      .map((width, index) => ({ width, index }))
      .sort((a, b) => b.width - a.width)
      .map(obj => obj.index);

    // Distribute reduction among the widest columns
    let remainingReduction = widthToReduce;

    for (const idx of sortedIndices) {
      if (remainingReduction <= 0) {
        break;
      }

      if (!fields[idx]) {
        continue;
      }

      if (typeof isImportantField === "function" && isImportantField(fields[idx])) {
        continue;
      }

      columnWidths[idx] ??= 0;

      // Set minimum column width
      const minColWidth = naturalWidths[idx] ? Math.max(5, naturalWidths[idx] * 0.3) : 5;
      const maxReduction = columnWidths[idx] - minColWidth;

      if (maxReduction > 0) {
        const reduction = Math.min(maxReduction, remainingReduction);
        columnWidths[idx] -= reduction;
        remainingReduction -= reduction;
      }
    }

    // If additional reduction is needed, proportionally reduce remaining columns
    if (remainingReduction > 0) {
      const totalAdjustableWidth = columnWidths.reduce(
        (sum, width, idx) => sum + (fields[idx] && isImportantField?.(fields[idx]) ? 0 : width),
        0,
      );
      const scalingFactor = (totalAdjustableWidth - remainingReduction) / totalAdjustableWidth;

      columnWidths = columnWidths.map((width, idx) => {
        if (fields[idx] && isImportantField?.(fields[idx])) {
          return width; // Preserve fixed width for important fields
        } else {
          return Math.max(5, Math.floor(width * scalingFactor));
        }
      });
    }
  }

  // Ensure column widths are integers
  columnWidths = columnWidths.map(Math.floor);

  const table = new Table({
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "  ",
    },
    style: { "padding-left": 0, "padding-right": 0 },
    colWidths: columnWidths,
    head: fields,
  });

  list.forEach(item => {
    const row = fields.map(field => {
      let value = getter(item, field);

      if (typeof value === "object") {
        value = JSON.stringify(value);
      }

      if (isObjectId(value)) {
        value = chalk.bold(String(value));
      }

      if (value === undefined) {
        value = chalk.gray("undefined");
      }

      return String(value);
    });

    table.push(row);
  });

  return table.toString();
};
