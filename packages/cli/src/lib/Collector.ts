import { JSONSubtypeArray, JSONTypeObject } from "@graphand/core";
import qs from "qs";
import { isIntegerOrIntString, mergeDeep, replaceAllStrings } from "./utils.js";
import fs from "fs";
import path from "path";
import mime from "mime";
import archiver from "archiver";
import { ReadableStream } from "stream/web";

class Collector {
  static decodeFileBase64 = (value: string) => {
    const filePath = path.resolve(String(value));
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }

    const fileContent = fs.readFileSync(filePath);
    const file = Buffer.from(fileContent);
    return file.toString("base64");
  };

  static decodeFileText = (value: string) => {
    const filePath = path.resolve(String(value));
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }

    const fileContent = fs.readFileSync(filePath);
    return fileContent.toString();
  };

  static decodeFile = (value: string): Promise<File> => {
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

  static decodeZip = async (value: string): Promise<File> => {
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

  static setter = (value: string, previous?: JSONTypeObject | JSONSubtypeArray): JSONTypeObject | JSONSubtypeArray => {
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
            return this.decodeFileBase64(v || "");
          }
          case "fileText": {
            return this.decodeFileText(v || "");
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

  static file = (value: string, previous?: Record<string, Promise<File>>): Record<string, Promise<File>> => {
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
          return this.decodeZip(v || "");
        }
        case "file":
        default: {
          return this.decodeFile(v || "");
        }
      }
    };

    previous ??= {};
    previous[field] = _getFile(path);

    return previous;
  };
}

export default Collector;
