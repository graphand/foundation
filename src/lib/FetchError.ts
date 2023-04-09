import { CoreError } from "@graphand/core";
import { FetchErrorDefinition } from "../types";

class FetchError extends CoreError {
  type: string;

  constructor(definition?: FetchErrorDefinition) {
    super(definition);

    this.type = definition?.type ?? "FetchError";
  }
}

export default FetchError;
