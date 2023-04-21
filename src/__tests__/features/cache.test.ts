import { generateModel, generateRandomString } from "../../lib/test-utils";

describe("test query caching", () => {
  describe("get", () => {
    it("should fetch only one time", async () => {
      const model = await generateModel();
      const instance = await model.create({ title: generateRandomString() });
      const spy = jest.spyOn(model.getAdapter().updaterSubject, "next");
      await model.clearCache();

      expect(spy).toHaveBeenCalledTimes(0);

      await model.get(instance._id);
      await model.get(instance._id);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should fetch only one time when running queries at same time", async () => {
      const model = await generateModel();
      const instance = await model.create({ title: generateRandomString() });
      const spy = jest.spyOn(model.getAdapter().updaterSubject, "next");
      await model.clearCache();

      expect(spy).toHaveBeenCalledTimes(0);

      await Promise.all([model.get(instance._id), model.get(instance._id)]);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getList", () => {
    it("should fetch only one time", async () => {
      const model = await generateModel();
      const instances = await model.createMultiple(
        Array.from({ length: 10 }, () => ({ title: generateRandomString() }))
      );
      const spy = jest.spyOn(model.getAdapter().updaterSubject, "next");
      await model.clearCache();

      expect(spy).toHaveBeenCalledTimes(0);

      await model.getList({ ids: instances.map((i) => i._id) });
      await model.getList({ ids: instances.map((i) => i._id) });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should fetch only one time when running queries at same time", async () => {
      const model = await generateModel();
      const instances = await model.createMultiple(
        Array.from({ length: 10 }, () => ({ title: generateRandomString() }))
      );
      const spy = jest.spyOn(model.getAdapter().updaterSubject, "next");
      await model.clearCache();

      expect(spy).toHaveBeenCalledTimes(0);

      await Promise.all([
        model.getList({ ids: instances.map((i) => i._id) }),
        model.getList({ ids: instances.map((i) => i._id) }),
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("creating a new instance should invalidate the cache", async () => {
      const model = await generateModel();
      const instances = await model.createMultiple(
        Array.from({ length: 10 }, () => ({ title: generateRandomString() }))
      );
      const spy = jest.spyOn(model.getAdapter().updaterSubject, "next");
      await model.clearCache();

      expect(spy).toHaveBeenCalledTimes(0);

      await model.getList({ ids: instances.map((i) => i._id) });
      await model.getList({ ids: instances.map((i) => i._id) });

      expect(spy).toHaveBeenCalledTimes(1);

      await model.create({ title: generateRandomString() });
      await model.getAdapter().instancesMap.clear();

      expect(spy).toHaveBeenCalledTimes(2);

      await model.getList({ ids: instances.map((i) => i._id) });

      expect(spy).toHaveBeenCalledTimes(3);
    });
  });
});
