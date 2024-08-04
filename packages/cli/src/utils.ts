import chalk from "chalk";
import { UserConfig } from "@/types";
import path from "node:path";
import fs from "node:fs";
import Conf from "conf";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { Client } from "@graphand/client";
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

export const loadConf = (): Conf => {
  return new Conf({ projectName: "@graphand/cli" });
};

export const loadConfig = async (): Promise<UserConfig> => {
  const configPath = loadConfigFile();
  if (!configPath) {
    throw new Error("Configuration file not found");
  }

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
      await fs.promises.unlink(tempFilePath);

      if (importedConfig.default) {
        return importedConfig.default as UserConfig;
      }

      throw new Error("No valid configuration found in file");
    } finally {
      // Ensure temp file is deleted even if an error occurs
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  } catch (error) {
    console.error("Error loading configuration:", error);
    throw new Error("Failed to load configuration file");
  }
};

export const getClient = async () => {
  const config = await loadConfig();
  const conf = loadConf();
  return new Client(
    [
      [
        ModuleAuth,
        {
          storage: {
            setItem: (key, value) => conf.set(key, value),
            getItem: key => String(conf.get(key)),
            removeItem: key => conf.delete(key),
          },
          handleRedirect: url => {
            console.log(chalk.green(`Opening ${url} in your browser...`));
            open(url);
          },
        },
      ],
    ],
    config.client,
  );
};
