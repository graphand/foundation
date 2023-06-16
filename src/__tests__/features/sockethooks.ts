import { Sockethook } from "@graphand/core";
import {
  generateModel,
  generateRandomString,
  getClientWithSocket,
} from "../../lib/test-utils";

describe("test sockethooks", () => {
  it("should be able to handle sockethook", async () => {
    // generating new model
    const model = await generateModel({ keyField: null });

    // client connected to socket -> client that will handle sockethook requests
    const client = getClientWithSocket();

    // creating sockethook
    const sockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
    });

    const fn = jest.fn();

    // handle sockethook request
    client.sockethook(sockethook.name, fn);

    await client.getModel(model.slug).create({});

    expect(fn).toBeCalledTimes(1);
  });

  it("should be able to reconnect and then handle sockethook", async () => {
    const model = await generateModel({ keyField: null });
    const client = getClientWithSocket();
    const sockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
    });

    const fn = jest.fn();

    client.sockethook(sockethook.name, fn);

    await new Promise((resolve) => setTimeout(resolve, 100));

    client.__socketsMap.get("project").disconnect();

    await new Promise((resolve) => setTimeout(resolve, 100));

    client.__socketsMap.get("project").connect();

    await client.getModel(model.slug).create({});

    expect(fn).toBeCalledTimes(1);
  });

  it("should execute sockethooks in order", async () => {
    const model = await generateModel({ keyField: null });
    const client = getClientWithSocket();
    const sockethook = await client.getModel(Sockethook).create({
      name: generateRandomString(),
      phase: "before",
      action: "createOne",
      on: model.slug,
    });

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
});
