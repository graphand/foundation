import { CoreError, Data, FieldTypes, models } from "@graphand/core";
import { generateModel } from "../../lib/test-utils";
import ClientAdapter from "src/lib/ClientAdapter";

class TestModelPage extends Data {
  title: FieldDefinitionText;
  random: FieldDefinitionNumber;
  obj: FieldDefinitionNested<{
    nestedField: FieldDefinitionText;
  }>;
}

describe("test pages models", () => {
  let model: typeof TestModelPage;

  beforeAll(async () => {
    model = (await generateModel({
      fields: {
        title: {
          type: FieldTypes.TEXT,
        },
        random: {
          type: FieldTypes.NUMBER,
        },
        obj: {
          type: FieldTypes.NESTED,
          options: {
            fields: {
              nestedField: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      },
      single: true,
    })) as typeof model;
  });

  it("should not be able to create single model instance as it should be created whith datamodel", async () => {
    await expect(model.create({})).rejects.toThrow(CoreError);
  });

  it("should be able to get datamodel & page instance with only one fetch", async () => {
    const adapter = model.getAdapter() as ClientAdapter;

    model.clearCache();
    models.DataModel.clearCache();

    expect(adapter.instancesMap.size).toBe(0);

    const datamodel = await models.DataModel.get({
      filter: {
        slug: model.slug,
      },
    });

    expect(datamodel).toBeInstanceOf(models.DataModel);

    expect(adapter.instancesMap.size).toBe(1);
  });

  it("should be able to update single model instance", async () => {
    const page = await model.get();

    expect(page).toBeInstanceOf(model);

    await page.update({
      $set: {
        "obj.nestedField": "test",
      },
    });

    expect(page.obj.nestedField).toBe("test");

    globalThis.client.getModel(models.DataModel).clearCache();
    model.clearCache();

    const page2 = await model.get();

    expect(page.obj.nestedField).toBe("test");
  });
});
