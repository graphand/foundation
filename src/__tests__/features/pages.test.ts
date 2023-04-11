import { CoreError, Data, FieldTypes, models } from "@graphand/core";
import { generateModel } from "../../lib/test-utils";
import ClientAdapter from "src/lib/ClientAdapter";

class TestModelPage extends Data {
  title: FieldDefinitionText;
  random: FieldDefinitionNumber;
  obj: FieldDefinitionJSON<{
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
          type: FieldTypes.JSON,
          options: {
            fields: {
              nestedField: {
                type: FieldTypes.TEXT,
              },
            },
          },
        },
      },
      isPage: true,
    })) as typeof model;
  });

  it("should not be able to create page model instance as it should be created whith datamodel", async () => {
    await expect(model.create({})).rejects.toThrow(CoreError);
  });

  it("should be able to get datamodel & page instance with only one fetch", async () => {
    const adapter = model.getAdapter() as ClientAdapter;
    adapter.instancesMap.clear();

    const DM = globalThis.client.getModel(models.DataModel);

    DM.clearCache();

    expect(adapter.instancesMap.size).toBe(0);

    const datamodel = await DM.get({
      filter: {
        slug: model.slug,
      },
    });

    expect(datamodel).toBeInstanceOf(models.DataModel);

    expect(adapter.instancesMap.size).toBe(1);
  });
});
