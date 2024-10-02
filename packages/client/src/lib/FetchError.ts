import { CoreError, ErrorCodes } from "@graphand/core";
import { FetchErrorDefinition } from "../types.js";

export class FetchError extends CoreError {
  res: Response | undefined;

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
