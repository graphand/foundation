import fs from "fs";
import path from "path";
import { build } from "esbuild";
import { pathToFileURL } from "url";
import { JSONObject } from "@graphand/core";
import { loadPackageJson } from "./utils.js";
import { Config } from "./Config.js";
import Collector from "./Collector.js";

export class GDX {
  #gdx: JSONObject | undefined;
  #path: string | undefined;
  #files: Record<string, Promise<File>> | undefined;

  constructor(gdxOrPath: JSONObject | string | undefined = undefined) {
    if (typeof gdxOrPath === "string") {
      this.#path = gdxOrPath;
    } else if (typeof gdxOrPath === "object") {
      this.#gdx = gdxOrPath;
    } else {
      this.#path = GDX.getPath();
    }
  }

  static getPath(): string | undefined {
    const config = new Config();
    const configGdx = config.get?.()?.gdx;

    if (configGdx?.path) {
      const gdxPath = path.join(process.cwd(), configGdx.path);
      if (fs.existsSync(gdxPath)) {
        return gdxPath;
      }
    }

    const gdxFiles = ["graphand.gdx.ts", "graphand.gdx.js", "graphand.gdx.json"];

    for (const file of gdxFiles) {
      const gdxPath = path.join(process.cwd(), file);
      if (fs.existsSync(gdxPath)) {
        return gdxPath;
      }
    }

    return undefined;
  }

  getPath(): string | undefined {
    return this.#path;
  }

  getExtension(): string | undefined {
    return this.#path ? path.extname(this.#path)?.slice(1) : undefined;
  }

  remove(): void {
    if (!this.#path) {
      throw new Error("GDX file not found");
    }

    fs.rmSync(this.#path);
  }

  async load<T extends this>(this: T): Promise<T> {
    if (!this.#path) {
      throw new Error("GDX file not found");
    }

    try {
      const gdxContent = await fs.promises.readFile(this.#path, "utf8");
      const extension = this.getExtension();

      if (extension === "json") {
        this.#gdx = JSON.parse(gdxContent);
      } else {
        const tempFileName = "." + Date.now() + ".gdx.mjs";
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
          const importedGdx = await import(pathToFileURL(tempFilePath).href);
          if (importedGdx.default) {
            this.#gdx = importedGdx.default;
          }
        } finally {
          fs.promises.unlink(tempFilePath).catch(() => {});
        }
      }

      if (this.#gdx && "$cli.set" in this.#gdx && Object.keys(this.#gdx["$cli.set"] as object).length) {
        const set = this.#gdx["$cli.set"] as JSONObject;
        const assign = Object.entries(set).reduce((acc, [key, value]) => Collector.setter(`${key}=${value}`, acc), {});
        Object.assign(this.#gdx, assign);
      }

      if (this.#gdx && "$cli.file" in this.#gdx && Object.keys(this.#gdx["$cli.file"] as object).length) {
        const files = this.#gdx["$cli.file"] as JSONObject;
        this.#files = Object.entries(files).reduce((acc, [key, value]) => Collector.file(`${key}=${value}`, acc), {});
        const assign = Object.entries(files).reduce((acc, [key]) => Collector.setter(key, acc), {});
        Object.assign(this.#gdx, assign);
      }

      delete this.#gdx?.["$cli.set"];
      delete this.#gdx?.["$cli.file"];
      delete this.#gdx?.["$cli.function"];
    } catch (error) {
      throw new Error(`Failed to load GDX file: ${(error as Error).message}`);
    }

    if (!this.#gdx) {
      throw new Error("No valid GDX found in file");
    }

    return this;
  }

  get(): JSONObject | undefined {
    return this.#gdx;
  }

  getFiles(): Record<string, Promise<File>> | undefined {
    return this.#files;
  }

  setGdx(gdx: JSONObject): void {
    this.#gdx = gdx;
  }

  async save(): Promise<void> {
    const content = JSON.stringify(this.#gdx, null, 2);

    if (this.#path) {
      this.remove();
    }

    const basePath = this.#path ? path.dirname(this.#path) : process.cwd();
    const filePath = path.join(basePath, "graphand.gdx.json");
    await fs.promises.writeFile(filePath, content);
  }
}
