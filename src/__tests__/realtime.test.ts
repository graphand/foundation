import {
  fetchWatcher,
  generateRandomString,
  getClientWithSocket,
  generateModel,
  getClient,
} from "../lib/test-utils";
import Client from "../lib/Client";
import ClientAdapter from "../lib/ClientAdapter";

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
});
