import fs from "fs";
import path from "path";
import { program } from "commander";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Config, defineConfig } from "./Config.js";
import { UserConfig } from "@/types.js";

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    rmSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
  },
}));
vi.mock("path", () => ({
  default: {
    resolve: vi.fn((...args) => args.join("/")),
    join: vi.fn((...args) => args.join("/")),
    dirname: vi.fn(path => path.split("/").slice(0, -1).join("/")),
    extname: vi.fn(path => "." + path.split(".").pop()),
  },
}));
vi.mock("commander");

describe("Config", () => {
  const mockConfig: UserConfig = {
    client: {
      project: "test-project",
      accessToken: "test-token",
    },
  };

  const mockConfigPath = "/mock/path/graphand.config.js";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/mock/path");
    vi.mocked(path.resolve).mockImplementation((...args) => args.join("/"));
    vi.mocked(path.join).mockImplementation((...args) => args.join("/"));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with config object", () => {
      const config = new Config(mockConfig);
      expect(config.get()).toEqual(mockConfig);
    });

    it("should initialize with config path", () => {
      const config = new Config(mockConfigPath);
      expect(config.getPath()).toBe(mockConfigPath);
    });

    it("should initialize with null", () => {
      const config = new Config(null);
      expect(config.get()).toBeNull();
      expect(config.getPath()).toBeUndefined();
    });
  });

  describe("getPath", () => {
    it("should return path from commander options", () => {
      vi.mocked(program.opts).mockReturnValue({ config: mockConfigPath });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(path.resolve).mockReturnValue(mockConfigPath);

      const result = Config.getPath();
      expect(result).toBe(mockConfigPath);
    });

    it("should return null if commander path does not exist", () => {
      vi.mocked(program.opts).mockReturnValue({ config: mockConfigPath });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = Config.getPath();
      expect(result).toBeNull();
    });

    it("should return path from package.json if exists", () => {
      vi.mocked(program.opts).mockReturnValue({});
      vi.mocked(fs.existsSync).mockImplementation(p => p.toString().includes("package.json"));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          graphand: {
            config: "custom.config.js",
          },
        }),
      );

      const result = Config.getPath();
      expect(result).toBe("custom.config.js");
    });

    it("should return first found config file from default list", () => {
      vi.mocked(program.opts).mockReturnValue({});
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error();
      });
      vi.mocked(fs.existsSync).mockImplementation(p => p.toString().includes("graphand.config.ts"));

      const result = Config.getPath();
      expect(result).toBe("/mock/path/graphand.config.ts");
    });

    it("should return null if no config file found", () => {
      vi.mocked(program.opts).mockReturnValue({});
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error();
      });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = Config.getPath();
      expect(result).toBeNull();
    });
  });

  describe("getExtension", () => {
    it("should return file extension when path exists", () => {
      const config = new Config(mockConfigPath);
      vi.mocked(path.extname).mockReturnValue(".js");
      expect(config.getExtension()).toBe("js");
    });

    it("should return null when no path exists", () => {
      const config = new Config();
      expect(config.getExtension()).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("should remove config file when path exists", () => {
      const config = new Config(mockConfigPath);
      config.remove();
      expect(fs.rmSync).toHaveBeenCalledWith(mockConfigPath);
    });

    it("should throw error when no path exists", () => {
      const config = new Config();
      expect(() => config.remove()).toThrow("Configuration file not found");
    });
  });

  describe("load", () => {
    it("should load JSON config file", async () => {
      const config = new Config("/mock/path/graphand.config.json");
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await config.load();
      expect(config.get()).toEqual(mockConfig);
    });

    it.skip("should load TypeScript/JavaScript config file", async () => {
      const config = new Config("/mock/path/graphand.config.ts");
      vi.mocked(fs.promises.readFile).mockResolvedValue(`
        export default {
          client: {
            project: "test-project",
            accessToken: "test-token"
          }
        }
      `);
      vi.mocked(fs.promises.writeFile).mockResolvedValue();
      vi.mocked(fs.promises.unlink).mockResolvedValue();

      await config.load();
      expect(config.get()).toBeDefined();
    });

    it("should throw error when no path exists", async () => {
      const config = new Config();
      await expect(config.load()).rejects.toThrow("Configuration file not found");
    });

    it("should throw error when no valid configuration found", async () => {
      const config = new Config("/mock/path/graphand.config.json");
      vi.mocked(fs.promises.readFile).mockResolvedValue("{}");

      await expect(config.load()).rejects.toThrow("No project found in configuration");
    });
  });

  describe("save", () => {
    it("should save config to file", async () => {
      const config = new Config(mockConfig);
      vi.mocked(process.cwd).mockReturnValue("/mock/path");
      vi.mocked(path.join).mockReturnValue("/mock/path/graphand.config.js");

      await config.save();

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "/mock/path/graphand.config.js",
        expect.stringContaining("defineConfig"),
      );
    });

    it("should remove existing file before saving if path exists", async () => {
      const config = new Config(mockConfigPath);
      config.setConfig(mockConfig);
      vi.mocked(path.dirname).mockReturnValue("/mock/path");
      vi.mocked(path.join).mockReturnValue("/mock/path/graphand.config.js");

      await config.save();

      expect(fs.rmSync).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "/mock/path/graphand.config.js",
        expect.stringContaining("defineConfig"),
      );
    });
  });

  describe("getters and setters", () => {
    it("should get client config", () => {
      const config = new Config(mockConfig);
      expect(config.client).toEqual(mockConfig.client);
    });

    it("should get gdx config", () => {
      const configWithGdx = { ...mockConfig, gdx: { path: "/mock/gdx/path" } };
      const config = new Config(configWithGdx);
      expect(config.gdx).toEqual({ path: "/mock/gdx/path" });
    });

    it("should set config", () => {
      const config = new Config();
      config.setConfig(mockConfig);
      expect(config.get()).toEqual(mockConfig);
    });
  });

  describe("defineConfig", () => {
    it("should return config object unchanged", () => {
      const result = defineConfig(mockConfig);
      expect(result).toEqual(mockConfig);
    });
  });
});
