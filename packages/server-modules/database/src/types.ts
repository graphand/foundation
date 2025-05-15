import { JSONObject } from "@graphand/core";
import SessionManager from "./lib/session-manager.js";
import { parseQuery } from "./lib/utils.js";

export type ParsedQuery = Awaited<ReturnType<typeof parseQuery>>;

declare module "@graphand/core" {
  export namespace Model {
    let isSystem: boolean;
    let disableCache: boolean;
    let dbSlug: string;
    let ttl: number; // The ttl in seconds for the model data
  }

  export interface TransactionCtx {
    sessionManager?: SessionManager;
    continueBackground?: boolean;
    preventEndSession?: boolean;
    forceCommitSession?: boolean;
    parsedQuery?: ParsedQuery;
    parsedPayload?: JSONObject;
    parsedArrayPayload?: JSONObject[];
  }
}
