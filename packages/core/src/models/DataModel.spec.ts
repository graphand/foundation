import { generateRandomString, mockAdapter } from "@/lib/test-utils.dev.ts";
import { DataModel } from "./DataModel.ts";
import { ValidationError } from "@/lib/ValidationError.ts";

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
});
