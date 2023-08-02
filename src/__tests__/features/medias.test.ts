import { models } from "@graphand/core";
import { getFile } from "../../lib/test-utils";

describe("test medias", () => {
  it("should be able to create a public media", async () => {
    const file = await getFile();
    const media = await models.Media.create({ file });

    expect(media).toBeInstanceOf(models.Media);
    expect(media.name).toContain("sample.png");
    expect(media._mimetype).toBe("image/png");

    const url = globalThis.client.src(media.name);
    const res = await fetch(url);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const blob = await res.blob();
    expect(blob.size).toBe(file.size);
  });

  it("should be able to create a private media", async () => {
    const file = await getFile();
    const media = await models.Media.create({
      file,
      private: true,
    });

    expect(media).toBeInstanceOf(models.Media);
    expect(media.name).toContain("sample.png");
    expect(media._mimetype).toBe("image/png");

    const url = globalThis.client.src(media.name, undefined, true);
    const res = await fetch(url);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const blob = await res.blob();
    expect(blob.size).toBe(file.size);
  });

  it("should be able to create a media and resize it", async () => {
    const file = await getFile();
    const media = await models.Media.create({ file });

    expect(media).toBeInstanceOf(models.Media);
    expect(media.name).toContain("sample.png");
    expect(media._mimetype).toBe("image/png");

    const url = globalThis.client.src(media.name, {
      w: 10,
    });
    const res = await fetch(url);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");

    const blob = await res.blob();
    expect(blob.size).not.toBe(file.size);
  });

  it("should return resized file from cache if exists", async () => {
    const file = await getFile();
    const media = await models.Media.create({ file });

    const url = globalThis.client.src(media.name, {
      w: 10,
    });

    const start1 = Date.now();
    const res1 = await fetch(url);
    const end1 = Date.now();

    const start2 = Date.now();
    const res2 = await fetch(url);
    const end2 = Date.now();

    const duration1 = end1 - start1;
    const duration2 = end2 - start2;

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    expect(duration1).toBeGreaterThan(duration2);
  });
});
