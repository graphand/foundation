import chalk from "chalk";
import path from "path";
import fs from "fs";
import { build } from "esbuild";
import { Client, ClientModules, ClientOptions } from "@graphand/client";
import { ModuleAuth } from "@graphand/client-module-auth";
import { ModuleRealtime } from "@graphand/client-module-realtime";
import open from "open";
import ModuleCli from "./ModuleCli.js";
import ora, { Ora } from "ora";
import Table from "cli-table3";
import { AuthMethods, Function, isObjectId, JSONType, JSONObject, ModelJSON } from "@graphand/core";
import LogProcessor from "./LogProcessor.js";
import crypto from "crypto";
import { pathToFileURL } from "url";
import { Config } from "./Config.js";
import JobHandler from "./JobHandler.js";
import Collector from "./Collector.js";
import storage from "node-persist";
import os from "os";

export const getGdxPath = async (): Promise<string | null> => {
  const config = await new Config().load();

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

export const loadPackageJson = (): JSONObject | null => {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = fs.readFileSync(packageJsonPath, "utf8");
  return JSON.parse(packageJson);
};

export const loadGdx = async (
  opts: {
    ignoreProjectData?: boolean;
    client?: Client;
    models?: string[];
  } = {},
): Promise<{ json: JSONObject; file: Record<string, Promise<File>> | undefined }> => {
  const configPath = await getGdxPath();
  if (!configPath) {
    throw new Error("No gdx file found");
  }

  let json: JSONObject | undefined;
  let file: Record<string, Promise<File>> | undefined;

  if (path.extname(configPath) === ".json") {
    const configContent = await fs.promises.readFile(configPath, "utf8");
    json = JSON.parse(configContent);
  } else {
    const tempFileName = "." + Date.now() + ".gdx.mjs";
    const tempFilePath = path.join(process.cwd(), tempFileName);
    const packageJsonObject = loadPackageJson();
    await build({
      entryPoints: [configPath],
      outfile: tempFilePath,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "esnext",
      external: [
        ...Object.keys(packageJsonObject?.dependencies || {}),
        ...Object.keys(packageJsonObject?.devDependencies || {}),
      ],
    });

    try {
      // Load the transpiled code
      const importedConfig = await import(pathToFileURL(tempFilePath).href);

      if (importedConfig.default) {
        json = importedConfig.default as JSONObject;
      }
    } finally {
      // Ensure temp file is deleted even if an error occurs
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }

  if (json && "$cli.set" in json && Object.keys(json["$cli.set"] as object).length) {
    const set = json["$cli.set"] as JSONObject;
    const assign = Object.entries(set).reduce((acc, [key, value]) => Collector.setter(`${key}=${value}`, acc), {});

    mergeDeep(json, assign);
  }

  if (json && "$cli.file" in json && Object.keys(json["$cli.file"] as object).length) {
    const _file = json["$cli.file"] as JSONObject;
    file = Object.entries(_file).reduce((acc, [key, value]) => Collector.file(`${key}=${value}`, acc), {});

    const assign = Object.entries(_file).reduce((acc, [key]) => Collector.setter(key, acc), {});

    mergeDeep(json, assign);
  }

  if (json && "$cli.function" in json && Object.keys(json["$cli.function"] as object).length) {
    const _functions = json["$cli.function"] as Record<string, string>;
    const client = await getClient();
    json.functions ??= {};
    const functions = json.functions as Record<string, ModelJSON<typeof Function>>;
    for (const [key, value] of Object.entries(_functions)) {
      functions[key] ??= {};
      const f = functions[key]!;
      Object.assign(f, {
        exposed: f.exposed ?? true,
        runtime: f.runtime ?? "deno",
      });

      const functionPath = path.join(process.cwd(), value);
      const checksum = await checksumDirectory(functionPath);
      const func = await client
        .getModel(Function)
        .get(key)
        .catch(() => null);

      const bind = func ? func._checksum !== checksum : true;

      if (bind) {
        const zip = await Collector.decodeZip(value);
        file ??= {};
        file[`functions[${key}][file]`] = Promise.resolve(zip);
        // @ts-ignore
        functions[key].$force = true;
      }
    }
  }

  if (opts.ignoreProjectData && json) {
    const client = opts.client ?? (await getClient());
    Object.keys(json).forEach(key => {
      if (key.startsWith("$")) {
        return;
      }

      const model = client.getModel(key);
      const isProjectScoped = !model.isEnvironmentScoped && !model.extensible;

      if (isProjectScoped) {
        delete json![key];
      }
    });
  }

  if (opts.models?.length && json) {
    Object.keys(json as Record<string, unknown>).forEach(key => {
      if (!opts.models?.includes(key)) {
        delete json[key];
      }
    });
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
  Client<{}, [typeof ModuleAuth, typeof ModuleCli, typeof ModuleRealtime]>
> => {
  let spinnerText = globalThis.spinner?.text;
  if (globalThis.spinner) {
    globalThis.spinner.text = "Initializing client ...";
  }

  const config: Config = globalThis.userConfig ?? (await new Config().load());
  const configClient = (config.client || {}) as ClientOptions;

  // Initialize node-persist storage in user's home directory
  await storage.init({
    dir: path.join(os.homedir(), ".graphand", "cli", configClient.project || "head"),
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: "utf8",
  });

  // @ts-ignore
  const modules: ClientModules<[typeof ModuleAuth, typeof ModuleCli, typeof ModuleRealtime]> = [
    [
      ModuleAuth,
      {
        storage: {
          setItem: async (key: string, value: string) => {
            await storage.setItem(key, value);
          },
          getItem: async (key: string) => {
            return await storage.getItem(key);
          },
          removeItem: async (key: string) => {
            await storage.removeItem(key);
          },
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

  const client = new Client({ disableCache: true, ...configClient }, modules);

  await client.init();

  if (globalThis.spinner && spinnerText) {
    globalThis.spinner.text = spinnerText;
  }

  globalThis.client ??= client;

  return client;
};

export const withSpinner = async <T = any>(
  fn: (_spinner: Ora) => Promise<T> | T,
  opts?: {
    spinner?: Ora;
    start?: string;
    succeed?: string | ((_r: T) => string);
    fail?: string | ((_e: Error) => string);
    throw?: boolean;
    skipJobs?: boolean;
  },
): Promise<[T | undefined, Error | undefined]> => {
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

  let res: T | undefined;

  try {
    res = await fn(spinner);
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
            const jobHandler = new JobHandler(jobId, {
              spin: { spinner },
            });

            await jobHandler.wait();
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

  return [res, e];
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
    const result: JSONObject = {};
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
  }) as number[];

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

      const field = fields[idx];

      if (!field) {
        continue;
      }

      if (typeof isImportantField === "function" && isImportantField(field)) {
        continue;
      }

      columnWidths[idx] ??= 0;
      const width = columnWidths[idx] as number;

      // Set minimum column width
      const minColWidth = naturalWidths[idx] ? Math.max(5, (naturalWidths[idx] || 0) * 0.3) : 5;
      const maxReduction = width - minColWidth;

      if (maxReduction > 0) {
        const reduction = Math.min(maxReduction, remainingReduction);
        columnWidths[idx] -= reduction;
        remainingReduction -= reduction;
      }
    }

    // If additional reduction is needed, proportionally reduce remaining columns
    if (remainingReduction > 0) {
      const totalAdjustableWidth = columnWidths.reduce(
        (sum, width, idx) => sum + (fields[idx] && isImportantField?.(fields[idx]!) ? 0 : width),
        0,
      );
      const scalingFactor = (totalAdjustableWidth - remainingReduction) / totalAdjustableWidth;

      columnWidths = columnWidths.map((width, idx) => {
        const field = fields[idx];
        if (field && isImportantField?.(field)) {
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
