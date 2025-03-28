import { mockAdapter } from "@/lib/test-utils.dev.js";
import { DataModel } from "./data-model.js";
import { ValidationError } from "@/lib/validation-error.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { faker } from "@faker-js/faker";

describe("DataModel Model", () => {
  const adapter = mockAdapter();
  const DataModelModel = DataModel.extend({ adapterClass: adapter });

  it("should throw error if no slug", async () => {
    const datamodel = DataModelModel.hydrate({ slug: undefined });

    await expect(DataModelModel.validate([datamodel])).rejects.toThrow(ValidationError);
  });

  it("should throw error if hooks are invalid", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: faker.random.alphaNumeric(10),
      hooks: {
        // @ts-expect-error test
        before_createOne: true,
      },
    });

    await expect(DataModelModel.validate([datamodel])).rejects.toThrow(ValidationError);
  });

  it("should get nested property options (conditionalProperties) with data override", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: faker.random.alphaNumeric(10),
      properties: {},
    });

    const payload = {
      slug: "test",
      properties: {
        rel: {
          type: "relation",
          ref: "medias",
        },
      },
    };

    const json = datamodel.get("properties", "json", { defaults: false }, payload);

    expect(json?.rel).toEqual({
      type: "relation",
      ref: "medias",
    });
  });

  it("should serialize property validators (conditionalProperties)", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: faker.random.alphaNumeric(10),
      validators: [{ type: ValidatorTypes.REQUIRED, property: "rel" }],
    });

    expect(datamodel.get("validators", "json")).toEqual([{ type: ValidatorTypes.REQUIRED, property: "rel" }]); // min property does not exist for required validator

    const datamodel2 = DataModelModel.hydrate({
      slug: faker.random.alphaNumeric(10),
      validators: [{ type: ValidatorTypes.BOUNDARIES, property: "rel", min: 1 }],
    });

    expect(datamodel2.get("validators", "json")).toEqual([
      { type: ValidatorTypes.BOUNDARIES, property: "rel", min: 1 },
    ]);
  });
});
