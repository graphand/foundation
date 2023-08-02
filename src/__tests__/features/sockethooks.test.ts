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
  });
});
