import chalk from "chalk";
import { UserConfig } from "@/types";
import path from "node:path";
import fs from "node:fs";
import Conf from "conf";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { Client, Module, symbolModuleInit, symbolModuleDestroy, FetchError } from "@graphand/client";
import { ModuleAuth } from "@graphand/client-module-auth";
import open from "open";

export const defineConfig = (config: UserConfig): UserConfig => {
  return config;
};

export const loadConfigFile = (): string | null => {
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
    throw new Error("Configuration file not found");
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

class ModuleCli extends Module {
  static moduleName = "cli" as const;
  defaults = {};

  async [symbolModuleInit]() {
    const client = this.client() as unknown as Awaited<ReturnType<typeof getClient>>;

    client.hook(
      "afterRequest",
      async ({ err }) => {
        const unauthorized = err?.find(e => (e as FetchError).res?.status === 401) as FetchError;
        if (unauthorized) {
          throw new Error(
            `Unauthorized action: ${unauthorized.message}.\n` +
              chalk.yellow(`Please login with \`graphand login\` or \`graphand register\` first`),
          );
        }
      },
      { handleErrors: true },
    );
  }

  async [symbolModuleDestroy]() {}
}

export const getClient = async (): Promise<Client<[typeof ModuleAuth, typeof ModuleCli]>> => {
  const globalClient = Client.getGlobal();
  if (globalClient) {
    return globalClient;
  }

  const config = await loadConfig();
  const conf = loadConf(config.client.project);
  return new Client(
    [
      [
        ModuleAuth,
        {
          storage: {
            setItem: (key, value) => conf.set(key, value),
            getItem: key => conf.get(key) as string,
            removeItem: key => conf.delete(key),
          },
          handleRedirect: url => {
            console.log(chalk.green(`Opening ${url} in your browser...`));
            open(url);
          },
        },
      ],
      [ModuleCli],
    ],
    config.client,
  );
};
