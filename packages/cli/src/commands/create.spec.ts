import { ObjectId } from "bson";
import { faker } from "@faker-js/faker";
import { vi } from "vitest";
import { getClient } from "@/lib/utils.js";
import { _create, commandCreate } from "./create.js";
import ora from "ora";
import { controllerModelCreate, FieldTypes } from "@graphand/core";
import { Subject } from "@graphand/client";
import fs from "fs";
import path from "path";

vi.mock("fs");
vi.mock("path");

describe("Create Command", () => {
  globalThis.userConfig = {
    client: {
      accessToken: faker.internet.password(),
      project: faker.internet.password(),
    },
  };

  const datamodel = {
    _id: new ObjectId().toString(),
    slug: faker.random.alphaNumeric(10),
    definition: {
      fields: {
        title: {
          type: FieldTypes.TEXT,
        },
      },
    },
  };

  const spyConsole = vi.spyOn(console, "log").mockImplementation(() => {});
  const _fetch = globalThis.fetch;
  const routerSubject = new Subject<Request>();
  const spyFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async _req => {
    const req = _req as Request;

    routerSubject.next(req);

    if (req.url.endsWith("datamodels/query") && req.method === "POST") {
      return new Response(JSON.stringify({ data: { rows: [datamodel], count: 1 } }));
    }

    if (req.url.endsWith(`/${datamodel.slug}`) && req.method === "POST") {
      return new Response(JSON.stringify({ data: { _id: new ObjectId().toString(), title: faker.lorem.word() } }));
    }

    return _fetch(req);
  });

  beforeEach(() => {
    spyConsole.mockClear();
    spyFetch.mockClear();

    // Clear options
    const opts = commandCreate.opts();
    if (opts) {
      Object.keys(opts).forEach(key => delete opts[key]);
    }
  });

  it("should create an entry without set or file options", async () => {
    await commandCreate.parseAsync(["node", "create", datamodel.slug]);

    const opts = commandCreate.opts();

    expect(opts.set).toBeUndefined();
    expect(opts.file).toBeUndefined();
    expect(spyFetch).toHaveBeenCalledTimes(2); // Once for datamodels/query, once for create
  });

  it("should parse setters as object", async () => {
    await commandCreate.parseAsync(["node", "create", datamodel.slug, "--set", "foo[bar]=baz"]);

    const opts = commandCreate.opts();

    expect(opts).toMatchObject({ set: { foo: { bar: "baz" } } });
  });

  it("should handle file content as base64 when using @fileBase64", async () => {
    const spy1 = vi.spyOn(path, "resolve").mockReturnValue("/mocked/path/test.txt");
    const spy2 = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spy3 = vi.spyOn(fs, "readFileSync").mockReturnValue("test");

    await commandCreate.parseAsync(["node", "create", datamodel.slug, "--set", "test=@fileBase64:./test.txt"]);

    const opts = commandCreate.opts();

    expect(opts).toMatchObject({
      set: {
        test: btoa("test"),
      },
    });

    expect(spy1).toHaveBeenCalledWith("./test.txt");
    expect(spy2).toHaveBeenCalledWith("/mocked/path/test.txt");
    expect(spy3).toHaveBeenCalledWith("/mocked/path/test.txt");
    spy1.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  it("should handle file content as text when using @fileText", async () => {
    const spy1 = vi.spyOn(path, "resolve").mockReturnValue("/mocked/path/test.txt");
    const spy2 = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spy3 = vi.spyOn(fs, "readFileSync").mockReturnValue("test");

    await commandCreate.parseAsync(["node", "create", datamodel.slug, "--set", "test=@fileText:./test.txt"]);

    const opts = commandCreate.opts();

    expect(opts).toMatchObject({
      set: {
        test: "test",
      },
    });

    expect(spy1).toHaveBeenCalledWith("./test.txt");
    expect(spy2).toHaveBeenCalledWith("/mocked/path/test.txt");
    expect(spy3).toHaveBeenCalledWith("/mocked/path/test.txt");
    spy1.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  it("should handle stdin input when using @stdin", async () => {
    const spyStdin = vi.spyOn(process.stdin, "read").mockImplementation(() => "test");

    await commandCreate.parseAsync(["node", "create", datamodel.slug, "--set", "test=@stdin"]);

    const opts = commandCreate.opts();

    expect(opts).toMatchObject({ set: { test: "test" } });
    expect(spyStdin).toHaveBeenCalled();

    spyStdin.mockRestore();
  });

  it("should parse setters as array", async () => {
    await commandCreate.parseAsync([
      "node",
      "create",
      datamodel.slug,
      "--set",
      "[0][foo]=bar1",
      "--set",
      "[0][bar]=baz1",
      "--set",
      "[1][foo]=bar2",
      "--set",
      "[1][bar]=baz2",
    ]);

    const opts = commandCreate.opts();

    expect(opts.set).toBeInstanceOf(Array);
    expect(opts).toMatchObject({
      set: [
        { foo: "bar1", bar: "baz1" },
        { foo: "bar2", bar: "baz2" },
      ],
    });
  });

  it("should throw error if file is not found", async () => {
    const spy1 = vi.spyOn(path, "resolve").mockReturnValue("/mocked/path/test.txt");
    const spy2 = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    await expect(commandCreate.parseAsync(["node", "create", datamodel.slug, "--file", "./test.txt"])).rejects.toThrow(
      "not found",
    );

    expect(spy1).toHaveBeenCalledWith("./test.txt");
    expect(spy2).toHaveBeenCalledWith("/mocked/path/test.txt");
    spy1.mockRestore();
    spy2.mockRestore();
  });

  it("should parse file and create File object", async () => {
    const spy1 = vi.spyOn(path, "resolve").mockReturnValue("/mocked/path/test.txt");
    const spy2 = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spy3 = vi.spyOn(fs, "readFileSync").mockReturnValue("test");
    const spy4 = vi.spyOn(fs, "statSync").mockReturnValue({
      mtime: {
        getTime: () => new Date().getTime(),
      },
    } as any);

    await commandCreate.parseAsync([
      "node",
      "create",
      datamodel.slug,
      "--file",
      "./test.txt",
      "--skip-realtime-upload",
    ]);

    const opts = commandCreate.opts();

    expect(opts.set).toBeUndefined();
    expect(opts).toMatchObject({
      file: {
        file: expect.any(File),
      },
    });

    expect(spy1).toHaveBeenCalledWith("./test.txt");
    expect(spy2).toHaveBeenCalledWith("/mocked/path/test.txt");
    expect(spy3).toHaveBeenCalledWith("/mocked/path/test.txt");
    expect(spy4).toHaveBeenCalledWith("/mocked/path/test.txt");
    spy1.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
    spy4.mockRestore();
  });

  it("should create an entry and display success message", async () => {
    const spinner = ora();
    const spySucceed = vi.spyOn(spinner, "succeed");
    const spyFail = vi.spyOn(spinner, "fail");

    const res = await _create({ modelName: datamodel.slug, set: { title: faker.lorem.word() }, spinner });

    expect(res).toBeDefined();
    expect(res).toBeInstanceOf(Object);
    expect(res).toMatchObject({
      _id: expect.any(String),
      title: expect.any(String),
    });

    expect(spySucceed).toHaveBeenCalled();
    const succeedCall = spySucceed.mock.calls?.[0]?.[0];
    expect(succeedCall).toContain("successfully");
    expect(succeedCall).toContain(datamodel.slug);

    expect(spyFail).not.toHaveBeenCalled();
  });

  it("should use FormData if files are provided", async () => {
    const spinner = ora();

    const client = await getClient({ realtime: true });

    await client.init();

    const spyExecute = vi.spyOn(client, "execute");

    const title = faker.lorem.word();

    await _create({
      client,
      modelName: datamodel.slug,
      skipRealtimeUpload: true,
      set: { title },
      spinner,
      file: {
        file: new File(["test"], "test.txt", { type: "text/plain" }),
      },
    });

    const createCall = spyExecute.mock.calls.find(c => JSON.stringify(c[0]) === JSON.stringify(controllerModelCreate));

    expect(createCall).toBeDefined();

    expect(createCall?.[1]?.ctx).toHaveProperty("formData");

    const formData = createCall?.[1]?.ctx?.formData;

    const keys = Array.from(formData?.keys() ?? []);
    expect(formData).toBeInstanceOf(FormData);

    expect(keys).toEqual(["_json", "file"]);
  });

  it("should handle multiple file uploads", async () => {
    const spinner = ora();
    const client = await getClient({ realtime: true });
    await client.init();
    const spyExecute = vi.spyOn(client, "execute");

    await _create({
      client,
      modelName: datamodel.slug,
      skipRealtimeUpload: true,
      set: { title: faker.lorem.word() },
      spinner,
      file: {
        file1: new File(["test1"], "test1.txt", { type: "text/plain" }),
        file2: new File(["test2"], "test2.txt", { type: "text/plain" }),
      },
    });

    const createCall = spyExecute.mock.calls.find(c => JSON.stringify(c[0]) === JSON.stringify(controllerModelCreate));
    expect(createCall).toBeDefined();

    const formData = createCall?.[1]?.ctx?.formData;
    expect(formData).toBeInstanceOf(FormData);

    const keys = Array.from(formData?.keys() ?? []);
    expect(keys).toEqual(["_json", "file1", "file2"]);
  });
});
