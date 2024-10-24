export const __CLIENT_VERSION__ = JSON.stringify(__INTERNAL_CLIENT_VERSION__).replaceAll('"', "");

import "./augmentations";

export { Module, symbolModuleInit, symbolModuleDestroy } from "@/lib/Module.js";
export { Client } from "@/lib/Client.js";
export { BehaviorSubject } from "@/lib/BehaviorSubject.js";
export { Subject } from "@/lib/Subject.js";
export { ClientAdapter } from "@/lib/ClientAdapter.js";
export { ClientError } from "@/lib/ClientError.js";
export { FetchError } from "@/lib/FetchError.js";

export * from "@/types.js";
export default "@/lib/Client.js";
