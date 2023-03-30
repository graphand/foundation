import {
  fetchWatcher,
  generateRandomString,
  getClientWithSocket,
  generateModel,
  getClient,
  mockAccountWithRole,
} from "../../lib/test-utils";
import Client from "../../lib/Client";
import ClientAdapter from "../../lib/ClientAdapter";
import { RuleActions } from "@graphand/core";

describe("test realtime", () => {
  let model;

  beforeAll(async () => {
    const _model = await generateModel();
    model = _model.getBaseClass();
  });

  it("should receive event from socket when creating a document", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    let id;

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        if (e.operation === "create" && e.__socketId) {
          id = e.ids[0];
          return true;
        }
      },
      subject: "event",
    });

    const created = await client.getModel(model).create({
      title: generateRandomString(),
    });

    await expect(fetchPromise).resolves.toBeTruthy();

    expect(id).toEqual(created._id);
  });

  it("should not receive event from socket on the creator client when creating a document", async () => {
    const clientWithSocket = getClientWithSocket();

    const _model = clientWithSocket.getModel(model);

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        if (e.operation === "create" && e.__socketId) {
          return true;
        }
      },
      subject: "event",
    });

    await _model.create({
      title: generateRandomString(),
    });

    await expect(fetchPromise).resolves.toBeFalsy();
  });

  it("should receive events from socket when creating multiple document", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    let ids;

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        if (e.operation === "create" && e.__socketId) {
          ids = e.ids;
          return true;
        }
      },
      subject: "event",
    });

    const created = await client.getModel(model).createMultiple([
      {
        title: generateRandomString(),
      },
      {
        title: generateRandomString(),
      },
      {
        title: generateRandomString(),
      },
    ]);

    await expect(fetchPromise).resolves.toBeTruthy();

    const createdIds = created.map((doc) => doc._id);
    expect(ids).toEqual(createdIds);
  });

  it("should receive all ids even when creating many documents", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    let idsSet = new Set<string>();
    let idsArr: Array<string> = [];

    const adapter = _model.__adapter as ClientAdapter;
    const unsub = adapter.__eventSubject.subscribe((e) => {
      if (e.operation === "create" && e.__socketId) {
        e.ids.forEach(idsSet.add.bind(idsSet));
        idsArr = idsArr.concat(e.ids);
      }
    });

    await Promise.all(
      Array.from({ length: 200 }).map(() => {
        return client.getModel(model).create({
          title: generateRandomString(),
        });
      })
    );

    await Promise.all(
      Array.from({ length: 100 }).map(() => {
        return client.getModel(model).createMultiple([
          {
            title: generateRandomString(),
          },
          {
            title: generateRandomString(),
          },
        ]);
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    unsub();

    expect(idsSet.size).toEqual(400);
    expect(idsArr.length).toEqual(400);
  });

  it("should receive event from socket when updating a document", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    const instance = await client.getModel(model).create({
      title: generateRandomString(),
    });

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        return (
          e.operation === "update" &&
          e.ids.includes(instance._id) &&
          e.__socketId
        );
      },
      subject: "event",
    });

    await instance.update({
      $set: {
        title: generateRandomString(),
      },
    });

    await expect(fetchPromise).resolves.toBeTruthy();
  });

  it("should not receive event from socket on the updator client", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    const instance = await client.getModel(model).create({
      title: generateRandomString(),
    });

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        return (
          e.operation === "update" &&
          e.ids.includes(instance._id) &&
          e.__socketId
        );
      },
      subject: "event",
    });

    await _model.update(instance._id, {
      $set: {
        title: "newTitle",
      },
    });

    await expect(fetchPromise).resolves.toBeFalsy();
  });

  it("should receive events from socket when updating multiple document", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    const items = await client.getModel(model).createMultiple([
      {
        title: generateRandomString(),
      },
      {
        title: generateRandomString(),
      },
      {
        title: generateRandomString(),
      },
    ]);

    const ids = items.map((item) => item._id);

    const fetchPromise = fetchWatcher(_model, {
      fn: (e) => {
        return (
          e.operation === "update" &&
          e.ids.every((id) => ids.includes(id)) &&
          e.__socketId
        );
      },
      subject: "event",
    });

    await client.getModel(model).update(
      {
        ids,
      },
      {
        $set: {
          title: generateRandomString(),
        },
      }
    );

    await expect(fetchPromise).resolves.toBeTruthy();
  });

  it("should receive all ids even when updating many documents", async () => {
    const client = getClient();
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    let idsSet = new Set<string>();
    let idsArr: Array<string> = [];

    const created = await client.getModel(model).createMultiple(
      Array.from({ length: 300 }).map(() => ({
        title: generateRandomString(),
      }))
    );

    const adapter = _model.__adapter as ClientAdapter;
    const unsub = adapter.__eventSubject.subscribe((e) => {
      if (e.operation === "update" && e.__socketId) {
        e.ids.forEach(idsSet.add.bind(idsSet));
        idsArr = idsArr.concat(e.ids);
      }
    });

    const updated = await client.getModel(model).update(
      {
        ids: created.map((doc) => doc._id),
        limit: 300,
      },
      {
        $set: {
          title: generateRandomString(),
        },
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    unsub();

    expect(updated.length).toEqual(300);
    expect(idsSet.size).toEqual(updated.length);
    expect(idsArr.length).toEqual(updated.length);
  });

  it("should receive only ids of read-allowed documents when updating", async () => {
    const client = globalThis.client;
    const _model = client.getModel(model);

    const created = await _model.createMultiple(
      Array.from({ length: 100 }).map(() => ({
        title: generateRandomString(),
      }))
    );

    const createdIds = created.map((doc) => doc._id);

    const createWithTitleContainingB = created.filter((doc) => {
      return doc.title.includes("b");
    });

    const account = await mockAccountWithRole({
      rules: [
        {
          ref: model.slug,
          actions: [RuleActions.READ],
          filter: { title: { $regex: "b" } },
        },
      ],
    });

    const accessToken = await client.genAccountToken(account._id);

    const client2 = getClient({
      accessToken,
      refreshToken: null,
      sockets: ["project"],
    });

    const _model2 = client2.getModel(model);

    await _model2.initialize();

    const docs = await _model2.getList({ ids: createdIds });

    expect(docs.count).toEqual(createWithTitleContainingB.length);

    console.log(docs.count);

    let idsSet = new Set<string>();

    const adapter = _model2.__adapter as ClientAdapter;
    const unsub = adapter.__eventSubject.subscribe((e) => {
      if (e.operation === "update" && e.__socketId) {
        e.ids.forEach(idsSet.add.bind(idsSet));
      }
    });

    const updated = await _model.update(
      {
        ids: createdIds,
      },
      {
        $set: {},
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 300));

    unsub();

    expect(updated.length).toEqual(100);

    expect(idsSet.size).toEqual(createWithTitleContainingB.length);
  });
});
