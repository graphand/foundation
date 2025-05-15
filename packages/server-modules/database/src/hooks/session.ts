import { CoreError, Hook, Model } from "@graphand/core";
import { getRequestHelper } from "@graphand/server";
import { isRetryableMongoError } from "../lib/utils.js";
import SessionManager from "../lib/session-manager.js";

const hookSessionBefore: Hook<any, any, any>["fn"] = async function (data) {
  const { ctx, err, transaction } = data;
  const request = getRequestHelper(this);

  if (!ctx.sessionManager && !err) {
    ctx.sessionManager = new SessionManager(request, !ctx.continueBackground);
  }

  if (err && !ctx.sessionManager?.hasEnded && !ctx.preventEndSession) {
    await ctx.sessionManager?.end(true, errs => {
      if (errs.some(e => e.message.includes("retry") || ("codeName" in e && e.codeName === "NoSuchTransaction"))) {
        ctx.sessionManager = new SessionManager(request);
        throw transaction.retryToken;
      }

      let err = errs.find(e => e instanceof CoreError) || errs[0];

      if (!(err instanceof CoreError)) {
        err = new CoreError({
          message: "Error performing operation. Please try again later.",
        });
      }

      throw err;
    });
  }
};

const hookSessionAfter: Hook<any, any, any>["fn"] = async function (data) {
  const { ctx, err, transaction } = data;
  if (!ctx.sessionManager) {
    return;
  }

  const request = getRequestHelper(this);
  const abort = Boolean(!ctx.forceCommitSession && (request.hasEnded || err));

  const _handleError = async (errs: Error[]): Promise<Error | symbol> => {
    if (errs.some(isRetryableMongoError)) {
      await ctx.sessionManager?.reset();
      const delay = 200 + transaction.retries * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      throw transaction.retryToken;
    }

    let err = errs.find(e => e instanceof CoreError) || errs[0];

    if (!(err instanceof CoreError)) {
      err = new CoreError({
        message: "Error performing operation. Please try again later.",
      });
    }

    return err;
  };

  if (!ctx.preventEndSession) {
    await ctx.sessionManager.end(abort, async errs => {
      throw await _handleError(errs);
    });
  }

  if (err?.length) {
    await _handleError(err as Error[]);
  }
};

export const init = async (opts: { orderBefore: number; orderAfter: number }) => {
  const { orderBefore, orderAfter } = opts;

  Model.hook("before", "createOne", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "createOne", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "createOne", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });

  Model.hook("before", "createMultiple", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "createMultiple", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "createMultiple", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });

  Model.hook("before", "updateOne", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "updateOne", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "updateOne", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });

  Model.hook("before", "updateMultiple", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "updateMultiple", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "updateMultiple", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });

  Model.hook("before", "deleteOne", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "deleteOne", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "deleteOne", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });

  Model.hook("before", "deleteMultiple", hookSessionBefore, {
    order: orderBefore,
    handleErrors: true,
  });
  Model.hook("before", "deleteMultiple", hookSessionBefore, {
    order: orderAfter,
    handleErrors: true,
  });
  Model.hook("after", "deleteMultiple", hookSessionAfter, {
    order: orderAfter,
    handleErrors: true,
  });
};
