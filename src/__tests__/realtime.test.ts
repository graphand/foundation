import {
  fetchWatcher,
  generateRandomString,
  getClientWithSocket,
  generateModel,
} from "../lib/test-utils";
import Client from "../lib/Client";

describe("test realtime", () => {
  const client = globalThis.client as Client;
  let model;

  beforeAll(async () => {
    const _model = await generateModel();
    model = _model.getBaseClass();
  });

  it("should receive event from socket when creating a document", async () => {
    const clientWithSocket = getClientWithSocket();
    const _model = clientWithSocket.getModel(model);

    await _model.initialize();

    let id;

    const fetchPromise = fetchWatcher(
      _model,
      (e) => {
        if (e.operation === "create" && e.__fromSocket) {
          id = e.ids[0];
          return true;
        }
      },
      undefined,
      undefined,
      "event"
    );

    const created = await client.getModel(model).create({
      title: generateRandomString(),
    });

    await expect(fetchPromise).resolves.toBeTruthy();

    expect(id).toEqual(created._id);
  });

  it("should not receive event from socket on the creator client when creating a document", async () => {
    const clientWithSocket = getClientWithSocket();

    const _model = clientWithSocket.getModel(model);

    const fetchPromise = fetchWatcher(
      _model,
      (e) => {
        if (e.operation === "create" && e.__fromSocket) {
          return true;
        }
      },
      undefined,
      undefined,
      "event"
    );

    await _model.create({
      title: generateRandomString(),
    });

    await expect(fetchPromise).resolves.toBeFalsy();
  });
});
