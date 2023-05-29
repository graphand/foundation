import { ClientExecutorCtx } from "./types";

declare global {
  export type ExecutorCtx = ClientExecutorCtx;
}
