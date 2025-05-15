import { Model } from "@graphand/core";
import { getRequestHelper } from "@graphand/server";

export const init = () => {
  Model.hook(
    "before",
    "createOne",
    async function (data) {
      const { ctx } = data;

      if (!ctx.parsedPayload) {
        throw new Error("Parsed payload is required");
      }

      const request = getRequestHelper(this);

      Object.assign(ctx.parsedPayload, {
        _createdBy: await request.getIdentityString(),
        _createdAt: new Date(),
      });
    },
    { order: 2 },
  );

  Model.hook(
    "before",
    "createMultiple",
    async function (data) {
      const { ctx } = data;

      if (!ctx.parsedArrayPayload) {
        throw new Error("Parsed payload is required");
      }

      const request = getRequestHelper(this);
      const identity = await request.getIdentityString();
      const createdAt = new Date();

      for (const payload of ctx.parsedArrayPayload) {
        Object.assign(payload, {
          _createdBy: identity,
          _createdAt: createdAt,
        });
      }
    },
    { order: 2 },
  );

  // TODO: Implement updateOne & updateMultiple
};
