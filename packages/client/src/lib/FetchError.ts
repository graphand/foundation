import { CoreError, ErrorCodes } from "@graphand/core";
import { FetchErrorDefinition } from "../types";

export class FetchError extends CoreError {
  res: Response;

  constructor({ res, ...coreDefinition }: FetchErrorDefinition = {}) {
    coreDefinition.code ??= ErrorCodes.UNKNOWN;

    super(coreDefinition);

    this.res = res;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: "FetchError",
    };
  }
}
