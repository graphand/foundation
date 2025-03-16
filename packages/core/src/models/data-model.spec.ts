import { generateRandomString, mockAdapter } from "@/lib/test-utils.dev.js";
import { DataModel } from "./data-model.js";
import { ValidationError } from "@/lib/validation-error.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

describe("DataModel Model", () => {
  const adapter = mockAdapter();
  const DataModelModel = DataModel.extend({ adapterClass: adapter });

  it("should throw error if no slug", async () => {
    const datamodel = DataModelModel.hydrate({ slug: undefined });

    await expect(DataModelModel.validate([datamodel])).rejects.toThrow(ValidationError);
  });

  it("should throw error if hooks are invalid", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: generateRandomString(),
      hooks: {
        // @ts-expect-error test
        before_createOne: true,
      },
    });

    await expect(DataModelModel.validate([datamodel])).rejects.toThrow(ValidationError);
  });

  it("should get nested field options (conditionalFields) with data override", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: generateRandomString(),
      fields: {},
    });

    const payload = {
      slug: "test",
      fields: {
        rel: {
          type: "relation",
          options: {
            ref: "medias",
          },
        },
      },
    };

    const json = datamodel.get("fields", "json", { defaults: false }, payload);

    expect(json?.rel).toEqual({
      type: "relation",
      options: {
        ref: "medias",
      },
    });
  });

  it("should serialize field validators (conditionalFields)", async () => {
    const datamodel = DataModelModel.hydrate({
      slug: generateRandomString(),
      validators: [{ type: ValidatorTypes.REQUIRED, options: { field: "rel" } }],
    });

    expect(datamodel.get("validators", "json")).toEqual([{ type: ValidatorTypes.REQUIRED, options: { field: "rel" } }]); // min field does not exist for required validator

    const datamodel2 = DataModelModel.hydrate({
      slug: generateRandomString(),
      validators: [{ type: ValidatorTypes.BOUNDARIES, options: { field: "rel", min: 1 } }],
    });

    expect(datamodel2.get("validators", "json")).toEqual([
      { type: ValidatorTypes.BOUNDARIES, options: { field: "rel", min: 1 } },
    ]);
  });
});
