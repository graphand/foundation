import { CoreError, CoreErrorDefinition, ErrorCodes } from "@graphand/core";
import { HTTPStatusCodes } from "@/enums/http-status-codes.js";

type ServerErrorDefinition = CoreErrorDefinition & {
  appName?: string;
  httpStatusCode?: HTTPStatusCodes;
  data?: Record<string, any>;
};

export class ServerError extends CoreError {
  httpStatusCode: HTTPStatusCodes;
  data?: Record<string, any>;
  appName?: string;

  constructor({ httpStatusCode, data, appName, ...coreDefinition }: ServerErrorDefinition = {}) {
    coreDefinition.code ??= ErrorCodes.INTERNAL_ERROR;

    super(coreDefinition);

    this.httpStatusCode = httpStatusCode ?? HTTPStatusCodes.INTERNAL_SERVER_ERROR;
    this.data = data;
    this.appName = appName;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      httpStatusCode: this.httpStatusCode,
      type: "ServerError",
    };
  }
}
