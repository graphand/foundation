import { CoreErrorDefinition } from "@/types/index.js";
import { ErrorCodes } from "@/enums/error-codes.js";

/**
 * CoreError class is the base Error class for Graphand.
 * It includes a message and a code (src/enums/error-codes.ts).
 */
export class CoreError extends Error {
  #definition: CoreErrorDefinition;

  constructor(definition: CoreErrorDefinition = {}) {
    super();

    const { constructor } = Object.getPrototypeOf(this);

    if ("captureStackTrace" in Error) {
      Error.captureStackTrace(this, constructor);
    }

    this.#definition = definition;

    Object.defineProperty(this, "__definition", { enumerable: false });
  }

  get code() {
    return this.#definition.code ?? ErrorCodes.UNKNOWN;
  }

  get message() {
    return this.#definition.message ?? "Unknown error";
  }

  get type() {
    return "CoreError";
  }

  set code(code) {
    this.#definition.code = code;
  }

  set message(message) {
    this.#definition.message = message;
  }

  toJSON() {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
    };
  }

  toString() {
    return this.message;
  }

  static fromJSON(json: ReturnType<CoreError["toJSON"]>) {
    const { type, code, message } = json;

    if (type !== "CoreError") {
      throw new Error("Invalid JSON");
    }

    return new CoreError({ code, message });
  }
}
