import { CoreError, ErrorCodes } from "@graphand/core";
import { ClientErrorDefinition } from "../types";

class ClientError extends CoreError {
  data: Record<string, any> | undefined;

  constructor({ data, ...coreDefinition }: ClientErrorDefinition = {}) {
    coreDefinition.code ??= ErrorCodes.INTERNAL_ERROR;

    super(coreDefinition);

    this.data = data;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      type: "ClientError",
    };
  }
}

export default ClientError;
