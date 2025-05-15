import { parseModelObject } from "@/lib/utils.js";
import { JSONObject, Model } from "@graphand/core";

export const init = () => {
  Model.hook(
    "before",
    "createOne",
    async function (data) {
      const payload = JSON.parse(JSON.stringify(data.args[0]));
      await parseModelObject(payload, this.hydrate({}));
      data.ctx.parsedPayload = payload as JSONObject;
    },
    { order: -1 },
  );

  Model.hook("before", "createMultiple", async function (data) {
    const payload = JSON.parse(JSON.stringify(data.args[0]));
    const from = this.hydrate({});
    const payloadArr = Array.isArray(payload) ? payload : [payload];
    await Promise.all(payloadArr.map(p => parseModelObject(p, from)));
    data.ctx.parsedArrayPayload = payloadArr as JSONObject[];
  });

  Model.hook("before", "updateOne", async function (data) {
    const payload = JSON.parse(JSON.stringify(data.args[1]));
    await parseModelObject(payload, this.hydrate({}));
    data.ctx.parsedPayload = payload as JSONObject;
  });

  Model.hook("before", "updateMultiple", async function (data) {
    const payload = JSON.parse(JSON.stringify(data.args[1]));
    await parseModelObject(payload, this.hydrate({}));
    data.ctx.parsedPayload = payload as JSONObject;
  });
};
