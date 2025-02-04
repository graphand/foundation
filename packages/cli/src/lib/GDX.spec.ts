import fs from "fs";
import path from "path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { GDX } from "./GDX.js";
import { JSONObject } from "@graphand/core";

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

vi.mock("./Config.js", () => ({
  Config: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue({
      gdx: {
        path: "custom.gdx.js",
      },
    }),
  })),
}));

describe("GDX", () => {
  const mockGdx: JSONObject = {
    "$cli.set": {
      "models.user.name": "User",
    },
    "$cli.file": {
      "models.user.file": "user.json",
    },
    models: {
      user: {
        name: "User",
      },
    },
  };

  const mockGdxPath = "/mock/path/graphand.gdx.js";

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
    it("should initialize with gdx object", () => {
      const gdx = new GDX(mockGdx);
      expect(gdx.get()).toEqual(mockGdx);
    });

    it("should initialize with gdx path", () => {
      const gdx = new GDX(mockGdxPath);
      expect(gdx.getPath()).toBe(mockGdxPath);
    });

    it("should initialize with null and try to find gdx path", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const gdx = new GDX();
      expect(gdx.getPath()).toBe("/mock/path/custom.gdx.js");
    });
  });

  describe("getPath", () => {
    it("should return path from config if exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = GDX.getPath();
      expect(result).toBe("/mock/path/custom.gdx.js");
    });

    it("should return first found gdx file from default list", () => {
      vi.mocked(fs.existsSync).mockImplementation(p => p.toString().includes("graphand.gdx.ts"));
      const result = GDX.getPath();
      expect(result).toBe("/mock/path/graphand.gdx.ts");
    });

    it("should return undefined if no gdx file found", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = GDX.getPath();
      expect(result).toBeUndefined();
    });
  });

  describe("getExtension", () => {
    it("should return file extension when path exists", () => {
      const gdx = new GDX(mockGdxPath);
      expect(gdx.getExtension()).toBe("js");
    });

    it("should return undefined when no path exists", () => {
      const gdx = new GDX();
      expect(gdx.getExtension()).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("should remove gdx file when path exists", () => {
      const gdx = new GDX(mockGdxPath);
      gdx.remove();
      expect(fs.rmSync).toHaveBeenCalledWith(mockGdxPath);
    });

    it("should throw error when no path exists", () => {
      const gdx = new GDX();
      expect(() => gdx.remove()).toThrow("GDX file not found");
    });
  });

  describe("load", () => {
    it("should load JSON gdx file", async () => {
      const gdx = new GDX("/mock/path/graphand.gdx.json");
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockGdx));

      await gdx.load();
      const result = gdx.get();
      expect(result).toBeDefined();
      expect(((result?.models as JSONObject)?.user as JSONObject)?.name).toBe("User");
      expect(result?.["$cli.set"]).toBeUndefined();
      expect(result?.["$cli.file"]).toBeUndefined();
    });

    it("should throw error when no path exists", async () => {
      const gdx = new GDX();
      await expect(gdx.load()).rejects.toThrow("GDX file not found");
    });

    it("should throw error when no valid gdx found", async () => {
      const gdx = new GDX(mockGdxPath);
      vi.mocked(fs.promises.readFile).mockResolvedValue("{}");

      await expect(gdx.load()).rejects.toThrow("No valid GDX found in file");
    });
  });

  describe("save", () => {
    it("should save gdx to file", async () => {
      const gdx = new GDX(mockGdx);
      await gdx.save();

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "/mock/path/graphand.gdx.json",
        expect.stringContaining("models"),
      );
    });

    it("should remove existing file before saving if path exists", async () => {
      const gdx = new GDX(mockGdxPath);
      gdx.setGdx(mockGdx);

      await gdx.save();

      expect(fs.rmSync).toHaveBeenCalledWith(mockGdxPath);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "/mock/path/graphand.gdx.json",
        expect.stringContaining("models"),
      );
    });
  });
});
