import { Hook, Model } from "@graphand/core";

const checkRetryableError: Hook<any, any, any>["fn"] = async function (data) {
  const { err, ctx, transaction } = data;
  if (err?.some((e: any) => e.codeName === "NoSuchTransaction" || e.message.includes("has ended"))) {
    if (ctx.sessionManager) {
      ctx.sessionManager.end(true);
      delete ctx.sessionManager;
    }

    throw transaction.retryToken;
  }
};

export const init = async () => {
  Model.hook("after", "count", checkRetryableError, { handleErrors: true });
  Model.hook("after", "get", checkRetryableError, { handleErrors: true });
  Model.hook("after", "getList", checkRetryableError, { handleErrors: true });
};
