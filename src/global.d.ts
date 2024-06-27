import { ClientTransactionCtx } from "./types";

declare global {
  export type TransactionCtx = ClientTransactionCtx;
  export type SerializerCtx = any;
}
