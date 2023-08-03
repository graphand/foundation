import { IdentityTypes, Key, Sockethook, ModelDocument } from "@graphand/core";
import {
  generateModel,
  generateRandomString,
  getClient,
} from "../../lib/test-utils";
import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";

describe("test sockethooks", () => {
  const _createSockethook = async (
    assignSockethook: Partial<ModelDocument<Sockethook>> = {}
  ) => {
    // generating new model
    const model = await generateModel({ keyField: null });

    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    // client connected to socket -> client that will handle sockethook requests
    const client = getClient({
      sockets: ["project"],
    });

    // creating key
    const key = await client.getModel(Key).create({
      name: generateRandomString(),
      value: keyPair.publicKey,
    });

    client.setOptions({
      genKeyToken: {
        keyId: key._id,
        identityToken: jwt.sign(
          { type: IdentityTypes.ROLE, id: "admin" },
          keyPair.privateKey,
          { algorithm: "RS256" }
        ),
      },
    });

    // creating sockethook
    const sockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
      ...assignSockethook,
    });

    return { client, sockethook, model };
  };

  it("should be able to handle sockethook", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const fn = jest.fn();

    // handle sockethook request
    client.sockethook(sockethook.name, fn);

    await client.getModel(model.slug).create({});

    expect(fn).toBeCalledTimes(1);

    client.close();
  });

  it("should not be able to handle sockethook without genKeyToken option", async () => {
    const model = await generateModel({ keyField: null });

    const client = getClient({
      sockets: ["project"],
    });

    const sockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
    });

    client.sockethook(sockethook.name, () => null);

    await expect(client.getModel(model.slug).create({})).rejects.toThrow(
      "no socket handler found"
    );

    client.close();
  });

  it("should be able to reconnect and then handle sockethook", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const fn = jest.fn();

    client.sockethook(sockethook.name, fn);

    await new Promise((resolve) => setTimeout(resolve, 50));

    client.__socketsMap.get("project").disconnect();

    await new Promise((resolve) => setTimeout(resolve, 50));

    client.__socketsMap.get("project").connect();

    await expect(client.getModel(model.slug).create({})).resolves.toBeDefined();

    expect(fn).toBeCalledTimes(1);

    client.close();
  });

  it("should be able to reconnect during sockethook execution", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const fn = jest.fn();

    client.sockethook(sockethook.name, fn);

    const createPromise = client.getModel(model.slug).create({});

    await new Promise((resolve) => setTimeout(resolve, 50));

    client.__socketsMap.get("project").disconnect();

    await new Promise((resolve) => setTimeout(resolve, 50));

    client.__socketsMap.get("project").connect();

    await expect(createPromise).resolves.toBeDefined();

    expect(fn).toBeCalledTimes(1);

    client.close();
  });

  it("should execute sockethooks in order", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const order: number[] = [];

    client.sockethook<"before", "createOne", any>(sockethook.name, (data) => {
      order.push(data.args[0].number);
    });

    const length = 100;

    const _model = client.getModel(model.slug);
    await Array.from({ length }).reduce(async (prev, _, i) => {
      await prev;
      return _model.create({ number: i });
    }, Promise.resolve());

    expect(order.length).toBe(length);
    expect(order).toEqual(Array.from({ length }).map((_, i) => i));

    client.close();
  });

  it("should be able to update title from within a sockethook", async () => {
    const { client, sockethook, model } = await _createSockethook({
      blocking: true,
    });

    const newTitle = generateRandomString();

    client.sockethook<"before", "createOne", any>(sockethook.name, (data) => {
      return {
        args: [
          {
            ...data.args[0],
            title: newTitle,
          },
        ],
      };
    });

    const i = await client.getModel(model.slug).create({
      title: generateRandomString(),
    });

    expect(i.title).toBe(newTitle);

    client.close();
  });

  it("should not be able to update title from within a sockethook if its not blocking", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const newTitle = generateRandomString();

    client.sockethook<"before", "createOne", any>(sockethook.name, (data) => {
      return {
        args: [
          {
            ...data.args[0],
            title: newTitle,
          },
        ],
      };
    });

    const i = await client.getModel(model.slug).create({
      title: generateRandomString(),
    });

    expect(i.title).not.toBe(newTitle);

    client.close();
  });

  it("should be able to handle multiple sockethooks", async () => {
    const { client, sockethook, model } = await _createSockethook();
    const secondSockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
    });

    const fn1 = jest.fn();
    const fn2 = jest.fn();

    client.sockethook(sockethook.name, fn1);
    client.sockethook(secondSockethook.name, fn2);

    await client.getModel(model.slug).create({});

    expect(fn1).toBeCalledTimes(1);
    expect(fn2).toBeCalledTimes(1);

    client.close();
  });

  it("should handle sockethook even with an erroneous sockethook present", async () => {
    const { client, sockethook, model } = await _createSockethook({
      blocking: true,
    });
    const erroneousSockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
      blocking: true,
    });

    const fn = jest.fn();

    client.sockethook(sockethook.name, fn);
    client.sockethook(erroneousSockethook.name, () => {
      throw new Error("Erroneous sockethook");
    });

    await expect(client.getModel(model.slug).create({})).rejects.toThrow(
      "Erroneous sockethook"
    );

    expect(fn).toBeCalledTimes(1);

    client.close();
  });

  it("should handle parallel calls to the same sockethook correctly", async () => {
    const { client, sockethook, model } = await _createSockethook();

    const fn = jest.fn();

    client.sockethook(sockethook.name, fn);

    await Promise.all([
      client.getModel(model.slug).create({}),
      client.getModel(model.slug).create({}),
    ]);

    expect(fn).toBeCalledTimes(2);

    client.close();
  });

  it("should throw an error if sockethook is handled with 2 different functions", async () => {
    const { client, sockethook, model } = await _createSockethook();
    const client2 = getClient({
      ...client.options,
    });

    client.sockethook(sockethook.name, function a() {});
    client2.sockethook(sockethook.name, function b() {});

    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(client.getModel(model.slug).create({})).rejects.toThrow(
      "different signatures"
    );

    client.close();
    client2.close();
  });

  it("should be able to create a document from within a sockethook", async () => {
    const { client, sockethook, model } = await _createSockethook({
      blocking: true,
    });

    // generating new model
    const model2 = await generateModel({ keyField: null });

    client.sockethook<"before", "createOne", any>(
      sockethook.name,
      async (data) => {
        await client.getModel(model2.slug).create({
          title: generateRandomString(),
        });
      }
    );

    await client.getModel(model.slug).create({
      title: generateRandomString(),
    });

    await expect(client.getModel(model.slug).getList()).resolves.toHaveLength(
      1
    );
    await expect(client.getModel(model2.slug).getList()).resolves.toHaveLength(
      1
    );

    client.close();
  });

  it("should throw error if deadlock loop is detected", async () => {
    const { client, sockethook, model } = await _createSockethook({
      blocking: true,
    });

    client.sockethook<"before", "createOne", any>(sockethook.name, async () => {
      await client.getModel(model.slug).create({
        title: generateRandomString(),
      });
    });

    await expect(
      client.getModel(model.slug).create({
        title: generateRandomString(),
      })
    ).rejects.toThrow("Deadlock detected");

    client.close();
  });
});
