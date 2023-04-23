import { Data, FieldTypes } from "@graphand/core";
import { generateModel, generateRandomString } from "../../lib/test-utils";

class TestModelPage extends Data {
  title: FieldDefinitionText;
}

describe("test limitations", () => {
  it("should limit to 1000 when creating more than 1000 elements at once", async () => {
    const model = await generateModel<typeof TestModelPage>({
      fields: {
        title: {
          type: FieldTypes.TEXT,
        },
      },
    });

    const created1 = await model.createMultiple(
      Array.from({ length: 500 }, () => ({
        title: generateRandomString(),
      }))
    );

    expect(created1.length).toBe(500);

    const created2 = await model.createMultiple(
      Array.from({ length: 1001 }, () => ({
        title: generateRandomString(),
      }))
    );

    expect(created2.length).toBe(1000);
  });

  it("should returns 100 elements if limit is not specified", async () => {
    const model = await generateModel<typeof TestModelPage>({
      fields: {
        title: {
          type: FieldTypes.TEXT,
        },
      },
    });

    await model.createMultiple(
      Array.from({ length: 1000 }, () => ({
        title: generateRandomString(),
      }))
    );

    await model.createMultiple(
      Array.from({ length: 1000 }, () => ({
        title: generateRandomString(),
      }))
    );

    const results = await model.getList({});

    expect(results.length).toBe(100);
    expect(results.count).toBe(2000);
  });

  it("should limit to 1000 when fetching more than 1000 elements at once", async () => {
    const model = await generateModel<typeof TestModelPage>({
      fields: {
        title: {
          type: FieldTypes.TEXT,
        },
      },
    });

    await model.createMultiple(
      Array.from({ length: 1000 }, () => ({
        title: generateRandomString(),
      }))
    );

    await model.createMultiple(
      Array.from({ length: 1000 }, () => ({
        title: generateRandomString(),
      }))
    );

    const results = await model.getList({
      limit: 1500,
    });

    expect(results.length).toBe(1000);
    expect(results.count).toBe(2000);
  });
});
