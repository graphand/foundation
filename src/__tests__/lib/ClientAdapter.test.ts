import { generateRandomString } from "../../lib/test-utils";
import { models, FieldTypes } from "@graphand/core";
import ClientAdapter from "../../lib/ClientAdapter";

describe("ClientAdapter", () => {
  let datamodel;
  let model;

  beforeAll(async () => {
    const slug = generateRandomString();

    datamodel = await globalThis.client.getModel(models.DataModel).create({
      name: slug,
      slug,
      fields: {
        title: {
          type: FieldTypes.TEXT,
          options: {},
        },
      },
      configKey: "title",
    });

    model = globalThis.client.getModel(datamodel.slug);
  });

  describe("ClientAdapter.create", () => {
    it("Model.create should returns the created instance", async () => {
      const created = await model.create({ title: "title" });
      expect(created).toBeInstanceOf(model);
      expect(typeof created._id).toBe("string");
      expect(created.title).toBe("title");
    });

    it("Model.create should emit on updater subject", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const eventPromise = new Promise((resolve) => {
        const unsub = adapter.updaterSubject.subscribe((e) => {
          unsub();
          resolve(e);
        });

        setTimeout(() => {
          unsub();
          resolve(null);
        }, 1000);
      });

      const created = await model.create({ title: "title" });

      await expect(eventPromise).resolves.toEqual({
        operation: "create",
        ids: [created._id],
      });
    });

    it("Model.create should add instances to map and then returns from get", async () => {
      const adapter = model.__adapter as ClientAdapter;

      const created = await model.create({ title: "title" });

      expect(adapter.instancesMap.get(created._id)).toBe(created);

      const fetchSpy = jest.spyOn(globalThis, "fetch");

      await expect(model.get(created._id)).resolves.toBe(created);

      expect(fetchSpy).not.toHaveBeenCalled();

      await expect(model.get({ filter: { _id: created._id } })).resolves.toBe(
        created
      );

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
