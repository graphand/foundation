import { Environment, ErrorCodes, Hook, isObjectId, Model } from "@graphand/core";
import { getRequestHelper } from "../utils.js";
import { ServerError } from "../server-error.js";
import { env } from "../env.js";
import { HTTPStatusCodes } from "@/enums/http-status-codes.js";

const checkModel: Hook<any, any, any>["fn"] = async function () {
  const model = this;
  const request = getRequestHelper(model);
  const environment = request.getEnvironment();

  if (isObjectId(environment)) {
    throw new ServerError({
      code: ErrorCodes.INVALID_PARAMS,
      message: `Invalid environment ${environment} on model ${model.slug}. Environment header must be the slug of the environment`,
      httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
    });
  }

  if (environment !== env.DEFAULT_ENV && model.configuration.isEnvironmentScoped) {
    const exists = await request.model(Environment).count(environment);

    if (!exists) {
      throw new ServerError({
        code: ErrorCodes.INVALID_PARAMS,
        message: `Invalid environment ${environment} on model ${model.slug}`,
        httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
      });
    }
  }
};

export const init = () => {
  Model.hook("before", "count", checkModel, { order: -2 });
  Model.hook("before", "get", checkModel, { order: -2 });
  Model.hook("before", "getList", checkModel, { order: -2 });
  Model.hook("before", "createOne", checkModel, { order: -2 });
  Model.hook("before", "createMultiple", checkModel, { order: -2 });
  Model.hook("before", "updateOne", checkModel, { order: -2 });
  Model.hook("before", "updateMultiple", checkModel, { order: -2 });
  Model.hook("before", "deleteOne", checkModel, { order: -2 });
  Model.hook("before", "deleteMultiple", checkModel, { order: -2 });
};
