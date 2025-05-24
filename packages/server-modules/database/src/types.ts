import { JSONObject } from "@graphand/core";
import SessionManager from "./lib/session-manager.js";
import { parseQuery } from "./lib/utils.js";

export type ParsedQuery = Awaited<ReturnType<typeof parseQuery>>;

declare module "@graphand/core" {
  export namespace Model {
    // eslint-disable-next-line no-unused-vars
    let isSystem: boolean;
    // eslint-disable-next-line no-unused-vars
    let disableCache: boolean;
    // eslint-disable-next-line no-unused-vars
    let dbSlug: string;
    // eslint-disable-next-line no-unused-vars
    let ttl: number;
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
