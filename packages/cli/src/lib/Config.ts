import fs from "fs";
import path from "path";
import { program } from "commander";
import { build } from "esbuild";
import { pathToFileURL } from "url";
import { UserConfig } from "@/types.js";
import { loadPackageJson } from "./utils.js";
import { JSONTypeObject } from "@graphand/core";

export class Config {
  #config: UserConfig | undefined;
  #path: string | undefined;

  constructor(configOrPath: UserConfig | string | undefined = undefined) {
    if (typeof configOrPath === "string") {
      this.#path = configOrPath as string;
    } else if (typeof configOrPath === "object") {
      this.#config = configOrPath as UserConfig;
    } else {
      this.#path = Config.getPath();
    }
  }

  static getPath(): string | undefined {
    const { config } = program.opts() || {};
    if (config) {
      const configPath = path.resolve(config);
      if (fs.existsSync(configPath)) {
        return configPath;
      }

      return undefined;
    }

    const packageJsonObject = loadPackageJson();
    const graphand = packageJsonObject?.graphand as JSONTypeObject;
    if (graphand?.config) {
      return path.resolve(graphand.config as string);
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

    return undefined;
  }

  getPath(): string | undefined {
    return this.#path;
  }

  getExtension(): string | undefined {
    return this.#path ? this.#path.split(".").pop() : undefined;
  }

  remove(): void {
    if (!this.#path) {
      throw new Error("Configuration file not found. Run `graphand init` to create a configuration file");
    }

    fs.rmSync(this.#path);
  }

  async load<T extends this>(this: T): Promise<T> {
    if (!this.#path) {
      throw new Error("Configuration file not found. Run `graphand init` to create a configuration file");
    }

    try {
      const configContent = await fs.promises.readFile(this.#path, "utf8");
      const extension = this.getExtension();

      if (extension === "json") {
        this.#config = JSON.parse(configContent) as UserConfig;
      } else {
        const tempFileName = "." + Date.now() + ".config.mjs";
        const tempFilePath = path.join(process.cwd(), tempFileName);
        const packageJsonObject = loadPackageJson();
        await build({
          entryPoints: [this.#path],
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
          const importedConfig = await import(pathToFileURL(tempFilePath).href);
          if (importedConfig.default) {
            this.#config = importedConfig.default as UserConfig;
          }
        } finally {
          // Ensure temp file is deleted even if an error occurs
          fs.promises.unlink(tempFilePath)?.catch(() => {});
        }
      }
    } catch (error) {
      throw new Error(`Failed to load configuration file: ${(error as Error).message}`);
    }

    if (!this.#config) {
      throw new Error("No valid configuration found in file");
    }

    if (!this.#config.client?.project) {
      throw new Error("No project found in configuration (client.project is undefined)");
    }

    return this;
  }

  get(): UserConfig | undefined {
    return this.#config;
  }

  setConfig(config: UserConfig): void {
    this.#config = config;
  }

  get client(): UserConfig["client"] | undefined {
    return this.#config?.client;
  }

  get gdx(): UserConfig["gdx"] | undefined {
    return this.#config?.gdx;
  }

  async save(): Promise<void> {
    const content = `
        import { defineConfig } from "@graphand/cli.js";

        export default defineConfig($CONFIG);
    `
      .replaceAll("  ", "")
      .replaceAll("$CONFIG", JSON.stringify(this.#config, null, 2))
      .trim();

    if (this.#path) {
      this.remove();
    }

    const basePath = this.#path ? path.dirname(this.#path) : process.cwd();
    const filePath = path.join(basePath, "graphand.config.js");
    await fs.promises.writeFile(filePath, content);
  }
}

export const defineConfig = (config: UserConfig): UserConfig => {
  return config;
};
