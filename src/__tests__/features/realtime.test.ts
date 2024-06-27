import {
  fetchWatcher,
  generateRandomString,
  generateModel,
  getClientProject,
  generateAccountWithRole,
} from "../../lib/test-utils";
import ClientAdapter from "../../lib/ClientAdapter";
import { FieldTypes, Model, RuleActions } from "@graphand/core";
import { ModelUpdaterEvent } from "@/types";
import Client from "@/lib/Client";

describe("test realtime", () => {
  let model: typeof Model & {
    definition: {
      fields: {
        title: {
          type: FieldTypes.TEXT;
        };
      };
    };
  };

  beforeAll(async () => {
    model = await generateModel({});
  });

  describe("create", () => {
    it("should receive event from socket when creating a document", async () => {
      const clientWithSocket = getClientProject({ socket: true });
      const _model = clientWithSocket.getModel(model);

      const fetchPromise = fetchWatcher(_model, {
        fn: (e) => e.operation === "create" && "__socketId" in e,
        subject: "event",
      });

      const created = await model.create({
        title: generateRandomString(),
      });

      await expect(fetchPromise).resolves.toBeTruthy();

      const res = (await fetchPromise) as ModelUpdaterEvent;

      expect(res.operation).toBe("create");
      expect(res.ids).toEqual([created._id]);
    });

    it("should receive events from socket when creating multiple document", async () => {
      const clientWithSocket = getClientProject({ socket: true });
      const _model = clientWithSocket.getModel(model);

      const fetchPromise = fetchWatcher(_model, {
        fn: (e) => e.operation === "create" && "__socketId" in e,
        subject: "event",
      });

      const created = await model.createMultiple(
        Array.from({ length: 10 }, () => ({
          title: generateRandomString(),
        }))
      );

      await expect(fetchPromise).resolves.toBeTruthy();

      const createdIds = created.map((doc) => doc._id);
      const res = (await fetchPromise) as ModelUpdaterEvent;
      expect(res.ids).toEqual(createdIds);
    });

    it("should receive all ids even when creating many documents", async () => {
      const clientWithSocket = getClientProject({ socket: true });
      const _model = clientWithSocket.getModel(model);

      const ids = new Set<string>();

      const fetchPromise = fetchWatcher(_model, {
        fn: (e) => {
          if (e.operation === "create" && "__socketId" in e) {
            e.ids.forEach(ids.add.bind(ids));
          }

          if (ids.size === 30) {
            return true;
          }
        },
        timeout: 5000,
        subject: "event",
      });

      await Promise.all(
        Array.from({ length: 10 }).map(() => {
          return model.create({
            title: generateRandomString(),
          });
        })
      );

      await Promise.all(
        Array.from({ length: 10 }).map(() => {
          return model.createMultiple(
            Array.from({ length: 2 }, () => ({
              title: generateRandomString(),
            }))
          );
        })
      );

      await expect(fetchPromise).resolves.toBeTruthy();

      expect(ids.size).toEqual(30);
    });

    it("should receive only ids of read-allowed documents when creating", async () => {
      const client: Client = globalThis.clientProject;

      const account = await generateAccountWithRole({
        rules: [
          {
            ref: model.slug,
            actions: [RuleActions.READ],
            filter: { title: { $regex: "b" } },
          },
        ],
      });

      const accessToken = await client.genAccountToken(account._id);

      const client2 = getClientProject({
        accessToken,
        refreshToken: null,
        socket: true,
      });

      const _model2 = client2.getModel(model);

      const ids = new Set<string>();

      const randomLength1 = Math.floor(Math.random() * 20);
      const randomLength2 = Math.floor(Math.random() * 20);

      const fetchPromise = fetchWatcher(_model2, {
        fn: (e) => {
          if (e.operation === "create" && "__socketId" in e) {
            e.ids.forEach(ids.add.bind(ids));
          }

          if (ids.size === randomLength2) {
            return true;
          }
        },
        subject: "event",
      });

      const created = await model.createMultiple(
        Array.from({ length: randomLength1 })
          .map(() => ({
            title: "a",
          }))
          .concat(
            Array.from({ length: randomLength2 }).map(() => ({
              title: "b",
            }))
          )
      );

      expect(created.length).toEqual(randomLength1 + randomLength2);

      await expect(fetchPromise).resolves.toBeTruthy();

      expect(ids.size).toBe(randomLength2);
    });
  });

  describe.only("update", () => {
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

      const adapter = _model.getAdapter() as ClientAdapter;
      const unsub = adapter.__eventSubject.subscribe((e) => {
        // @ts-ignore
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

      await new Promise((resolve) => setTimeout(resolve, 100));

      unsub();

      expect(updated.length).toEqual(300);
      expect(idsSet.size).toEqual(updated.length);
      expect(idsArr.length).toEqual(updated.length);
    });

    it.only("should receive only ids of read-allowed documents when updating", async () => {
      const client: Client = globalThis.clientProject;
      const _model = client.getModel(model);

      const created = await _model.createMultiple(
        Array.from({ length: 100 }).map(() => ({
          title: generateRandomString(),
        }))
      );

      const ids = created.map((doc) => doc._id);

      const createWithTitleContainingB = created.filter((doc) => {
        return doc.title.includes("b");
      });

      const account = await generateAccountWithRole({
        rules: [
          {
            ref: model.slug,
            actions: [RuleActions.READ],
            filter: { title: { $regex: "b" } },
          },
        ],
      });

      const accessToken = await client.genAccountToken(account._id);

      const client2 = getClientProject({
        accessToken,
        refreshToken: null,
        socket: true,
      });

      const _model2 = client2.getModel(model);

      const fetchPromise = fetchWatcher(_model2, {
        fn: (e) => e.operation === "update" && "__socketId" in e,
        subject: "event",
      });

      const docs = await _model2.getList({ ids });

      expect(docs.count).toEqual(createWithTitleContainingB.length);

      const updated = await _model.update({ ids }, { $set: {} });

      expect(updated.length).toEqual(100);

      await expect(fetchPromise).resolves.toBeTruthy();

      const res = (await fetchPromise) as ModelUpdaterEvent;

      expect(res.ids).toHaveLength(createWithTitleContainingB.length);
    });
  });

  describe("delete", () => {
    it("should receive event from socket when deleting a document", async () => {
      const client = getClient();
      const clientWithSocket = getClientWithSocket();
      const _model = clientWithSocket.getModel(model);

      const instance = await client.getModel(model).create({
        title: generateRandomString(),
      });

      const fetchPromise = fetchWatcher(_model, {
        fn: (e) => {
          return (
            e.operation === "delete" &&
            e.ids.includes(instance._id) &&
            e.__socketId
          );
        },
        subject: "event",
      });

      await instance.delete();

      await expect(fetchPromise).resolves.toBeTruthy();
    });

    it("should not receive event from socket on the deletor client", async () => {
      const client = getClient();
      const clientWithSocket = getClientWithSocket();
      const _model = clientWithSocket.getModel(model);

      const instance = await client.getModel(model).create({
        title: generateRandomString(),
      });

      const fetchPromise = fetchWatcher(_model, {
        fn: (e) => {
          return (
            e.operation === "delete" &&
            e.ids.includes(instance._id) &&
            e.__socketId
          );
        },
        subject: "event",
      });

      await _model.delete(instance._id);

      await expect(fetchPromise).resolves.toBeFalsy();
    });

    it("should receive events from socket when deleting multiple document", async () => {
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
            e.operation === "delete" &&
            e.ids.every((id) => ids.includes(id)) &&
            e.__socketId
          );
        },
        subject: "event",
      });

      await client.getModel(model).delete({
        ids,
      });

      await expect(fetchPromise).resolves.toBeTruthy();
    });

    it("should receive all ids even when deleting many documents", async () => {
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

      const adapter = _model.getAdapter() as ClientAdapter;
      const unsub = adapter.__eventSubject.subscribe((e) => {
        // @ts-ignore
        if (e.operation === "delete" && e.__socketId) {
          e.ids.forEach(idsSet.add.bind(idsSet));
          idsArr = idsArr.concat(e.ids);
        }
      });

      const deleted = await client.getModel(model).delete({
        ids: created.map((doc) => doc._id),
        limit: 300,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      unsub();

      expect(deleted.length).toEqual(300);
      expect(idsSet.size).toEqual(deleted.length);
      expect(idsArr.length).toEqual(deleted.length);
    });

    it("should receive all ids (even not read-allowed documents) when deleting", async () => {
      const client = globalThis.clientProject;
      const _model = client.getModel(model);

      const created = await _model.createMultiple(
        Array.from({ length: 100 }).map(() => ({
          title: generateRandomString(),
        }))
      );

      const createdIds = created.map((doc) => doc._id);

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

      let idsSet = new Set<string>();

      const adapter = _model2.getAdapter() as ClientAdapter;
      const unsub = adapter.__eventSubject.subscribe((e) => {
        // @ts-ignore
        if (e.operation === "delete" && e.__socketId) {
          e.ids.forEach(idsSet.add.bind(idsSet));
        }
      });

      await _model.delete({
        ids: createdIds,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      unsub();

      expect(idsSet.size).toEqual(100);
    });
  });
});
