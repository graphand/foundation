import { Redis, Cluster } from "ioredis";
import { ModuleDatabase } from "../module.js";
import { createRedisClient } from "./utils.js";
import { Model } from "@graphand/core";
import { DataDoc } from "@graphand/server";

export class RedisService {
  #client: Promise<Redis | Cluster> | null = null;
  #module: ModuleDatabase;
  #closed: boolean = false;
  #isReady: boolean = false;

  constructor(module: ModuleDatabase) {
    this.#module = module;
  }

  async getClient(): Promise<Redis | Cluster | null> {
    if (this.#closed) {
      return null;
    }

    if (!this.#client) {
      this.#client = this.createClient();
    }

    return this.#client;
  }

  private async createClient(): Promise<Redis | Cluster> {
    const { uri, password, cluster } = this.#module.conf.redis;

    const client = createRedisClient({ uri, password, cluster });

    client.on("ready", () => {
      this.#isReady = true;
    });

    client.on("error", () => {
      this.#isReady = false;
    });

    await client.connect();
    return client;
  }

  isReady(): boolean {
    return this.#isReady;
  }

  async close(): Promise<void> {
    this.#closed = true;
    if (this.#client) {
      const client = await this.#client;
      await client?.quit();
      this.#client = null;
    }
  }

  getModelCacheKey(model: typeof Model) {
    const dbName = this.#module.service.mongo.getDbNameForModel(model);

    let slug = model.dbSlug || model.configuration.slug;
    if (model.prototype instanceof DataDoc) {
      const _model = model as typeof DataDoc;
      slug = _model.modelSlug;
    }

    return [dbName, slug].join(".");
  }

  getOperationCacheKey(opts: {
    model: typeof Model;
    operation: string;
    filter: Record<string, any>;
    options?: Record<string, any>;
  }): string {
    const { model, operation } = opts;
    let { filter, options } = opts;

    if (!filter || typeof filter !== "object") {
      filter = {};
    }

    if (!options || typeof options !== "object") {
      options = {};
    }

    const _serializeObj = (obj: Record<string, any>, ignoreKeys?: Array<string>) => {
      let keys = Object.keys(obj);
      if (ignoreKeys) {
        keys = keys.filter(k => !ignoreKeys.includes(k));
      }

      return keys
        .sort()
        .map(key => {
          let v = obj[key];

          if (v && typeof v === "object") {
            v = JSON.stringify(v);
          }

          return [key, v].join(":");
        })
        .join("|");
    };

    const filterKey = _serializeObj(filter);
    const optionsKey = _serializeObj(options, ["session"]);

    const opKey = [operation, filterKey, optionsKey].join(".");

    return this.getModelCacheKey(model) + "," + opKey;
  }

  async get(key: string): Promise<Buffer | null> {
    const client = await this.getClient();
    if (!client) return null;
    return client.getBuffer(key);
  }

  async set(key: string, value: Buffer, ttl?: number): Promise<void> {
    const client = await this.getClient();
    if (!client) return;

    if (ttl) {
      await client.set(key, value, "EX", ttl);
    } else {
      await client.set(key, value);
    }
  }

  async keys(pattern: string, query?: boolean): Promise<string[]> {
    const client = await this.getClient();
    if (!client) return [];

    let keys: string[];

    if (query) {
      if ("nodes" in client && typeof client.nodes === "function") {
        // Redis Cluster
        const nodes: Redis[] = client.nodes("all");
        keys = [];

        for (const node of nodes) {
          const nodeKeys = await node.keys(pattern);
          keys.push(...nodeKeys);
        }
      } else {
        // Single Redis instance
        keys = await (client as Redis).keys(pattern);
      }
    } else {
      keys = [pattern];
    }

    return keys;
  }

  async delete(pattern: string, query?: boolean): Promise<string[]> {
    const client = await this.getClient();
    if (!client) return [];

    const keys = await this.keys(pattern, query);
    await Promise.all(keys.map(key => client?.del(key)));

    return keys;
  }

  async healthz(): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    if ("nodes" in client && typeof client.nodes === "function") {
      // Redis Cluster
      const nodes: Redis[] = client.nodes("all");
      return nodes.every(node => node.status === "ready");
    } else {
      // Single Redis instance
      return (client as Redis).status === "ready";
    }
  }

  async cleanup(scope: string): Promise<void> {
    await this.delete(scope + "*", true);
  }

  async clearCacheForModel(model: typeof Model) {
    const cacheKey = this.getModelCacheKey(model);
    await this.delete(cacheKey + ",*", true);
  }

  async clearCache(env?: string) {
    const dbName = env ? this.#module.service.mongo.getDbNameForEnv(env) : this.#module.service.mongo.getDbName();
    await this.delete(dbName + "*", true);
  }
}
