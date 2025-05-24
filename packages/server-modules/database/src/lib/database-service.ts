import { JSONObject, Model, ModelData, ModelInstance } from "@graphand/core";
import { ModuleDatabase } from "../module.js";
import { MongoService } from "./mongo-service.js";
import { RedisService } from "./redis-service.js";
import SessionManager from "./session-manager.js";
import { ParsedQuery } from "@/types.js";
import { ServerError } from "@graphand/server";
import { SerializerService } from "./serializer-service.js";

export class DatabaseService {
  #module: ModuleDatabase;
  #mongo: MongoService;
  #redis: RedisService;
  #serializer: SerializerService;

  constructor(module: ModuleDatabase) {
    this.#module = module;
    this.#mongo = new MongoService(module);
    this.#redis = new RedisService(module);
    this.#serializer = new SerializerService(module);
  }

  get mongo() {
    return this.#mongo;
  }

  get redis() {
    return this.#redis;
  }

  get serializer() {
    return this.#serializer;
  }

  async init() {
    await Promise.all([this.#serializer.init(), this.#mongo.getClient()]);

    // Do not await this as the database service should work even if redis is not ready to improve startup time
    this.#redis.getClient();
  }

  async destroy() {
    await this.#redis.close();
    // MongoDB client is closed automatically when the process exits
  }

  async exists(opts: {
    model: typeof Model;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<boolean> {
    const count = await this.count(opts);
    return count > 0;
  }

  get cacheEnabled() {
    return this.#module.conf.cache.enabled && this.#redis.isReady();
  }

  async count(opts: {
    model: typeof Model;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<number> {
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    delete options.skip;
    delete options.sort;

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const cacheEnabled = this.cacheEnabled && !opts.disableCache && !opts.model.disableCache;

    const cacheKey =
      cacheEnabled &&
      this.#redis.getOperationCacheKey({
        model: opts.model,
        filter,
        options,
        operation: "count",
      });

    if (cacheEnabled && cacheKey) {
      const cached = await this.#redis.get(cacheKey);
      if (cached) {
        return parseInt(cached.toString());
      }
    }

    const count = await this.#mongo.count({ model: opts.model, filter, options });

    if (cacheEnabled && !options.session && cacheKey) {
      this.#redis.set(cacheKey, Buffer.from(count.toString()), this.#module.conf.cache.ttl);
    }

    return count || 0;
  }

  async findDocument<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<ModelData<M> | null> {
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const cacheEnabled = this.cacheEnabled && !opts.disableCache && !opts.model.disableCache;
    const cacheKey =
      cacheEnabled &&
      this.#redis.getOperationCacheKey({
        model: opts.model,
        filter,
        options,
        operation: "findDocument",
      });

    if (cacheEnabled && cacheKey) {
      const cached = await this.#redis.get(cacheKey);
      if (cached) {
        return this.#serializer.fromBuffer<M>(cached);
      }
    }

    const document = await this.#mongo.findOne({ model: opts.model, filter, options });

    if (cacheEnabled && !options.session && cacheKey) {
      this.#redis.set(cacheKey, this.#serializer.toBuffer(document), this.#module.conf.cache.ttl);
    }

    return document;
  }

  async findOne<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<ModelInstance<M> | null> {
    const { model } = opts;
    const document = await this.findDocument(opts);
    return document ? model.hydrate(document) : null;
  }

  async findMany<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<ModelData<M>[]> {
    const { model } = opts;
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const cacheEnabled = this.cacheEnabled && !opts.disableCache && !opts.model.disableCache;
    const cacheKey =
      cacheEnabled &&
      this.#redis.getOperationCacheKey({
        model,
        filter,
        options,
        operation: "findMultiple",
      });

    if (cacheEnabled && cacheKey) {
      const cached = await this.#redis.get(cacheKey);
      if (cached) {
        return this.#serializer.fromBufferList<M>(cached) || [];
      }
    }

    const documents = await this.#mongo.findMany({ model, filter, options });

    if (cacheEnabled && !options.session && cacheKey) {
      this.#redis.set(cacheKey, this.#serializer.toBufferList(documents), this.#module.conf.cache.ttl);
    }

    return documents;
  }

  async findAndCount<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<{
    rows: Array<ModelInstance<M>>;
    count: number;
  } | null> {
    const { model } = opts;

    const [rows, count] = await Promise.all([
      this.findMany(opts),
      this.count({ ...opts, mergeFilter: { _slug: model.slug } }),
    ]);

    return {
      rows: rows.map(d => model.hydrate(d)),
      count,
    };
  }

  async insertOne<M extends typeof Model>(opts: {
    model: M;
    document?: ModelData<M>;
    parsedPayload?: JSONObject;
    sessionManager?: SessionManager;
    mergeOptions?: Record<string, any>;
  }): Promise<ModelInstance<M>> {
    const { model } = opts;

    const options = Object.assign({}, opts?.mergeOptions);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const document = (opts.document || opts.parsedPayload) as ModelData<M>;

    const inserted = await this.#mongo.insertOne({ model, document });

    if (!inserted) {
      throw new ServerError({
        message: "Failed to insert document",
      });
    }

    await this.#redis.clearCacheForModel(model);

    if (!options?.session) {
      const cacheKey = this.#redis.getOperationCacheKey({
        model,
        filter: { _id: inserted._id },
        operation: "findDocument",
      });
      this.#redis.set(cacheKey, this.#serializer.toBuffer(inserted), this.#module.conf.cache.ttl);
    }

    return model.hydrate(inserted);
  }

  async insertMany<M extends typeof Model>(opts: {
    model: M;
    documents?: ModelData<M>[];
    parsedArrayPayload?: JSONObject[];
    sessionManager?: SessionManager;
    mergeOptions?: Record<string, any>;
  }): Promise<ModelInstance<M>[]> {
    const { model } = opts;

    const options = Object.assign({}, opts?.mergeOptions);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const documents = (opts.documents || opts.parsedArrayPayload) as ModelData<M>[];

    const inserted = await this.#mongo.insertMany({ model, documents, options });

    await this.#redis.clearCacheForModel(model);

    if (!options?.session) {
      const cacheKey = this.#redis.getOperationCacheKey({
        model,
        filter: { _id: { $in: inserted.map(d => d._id) } },
        operation: "findMultiple",
      });
      this.#redis.set(cacheKey, this.#serializer.toBufferList(inserted), this.#module.conf.cache.ttl);
    }

    return inserted.map(d => model.hydrate(d));
  }

  async updateOne<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    parsedPayload?: JSONObject;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    mergeUpdate?: Record<string, any>;
    sessionManager?: SessionManager;
  }): Promise<ModelData<M>> {
    const { model } = opts;
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const update = (opts.parsedPayload || opts.mergeUpdate) as ModelData<M>;

    const updated = await this.#mongo.updateOne({ model, filter, update, options });

    await this.#redis.clearCacheForModel(model);

    if (!options?.session) {
      const cacheKey = this.#redis.getOperationCacheKey({
        model,
        filter,
        operation: "findDocument",
      });
      this.#redis.set(cacheKey, this.#serializer.toBuffer(updated), this.#module.conf.cache.ttl);
    }

    return updated;
  }

  async updateMany<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    parsedPayload?: JSONObject;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    mergeUpdate?: Record<string, any>;
    sessionManager?: SessionManager;
  }): Promise<Array<ModelInstance<M>>> {
    const { model } = opts;
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const update = (opts.parsedPayload || opts.mergeUpdate) as ModelData<M>;

    const updated = await this.#mongo.updateMany({ model, filter, update, options });

    if (!updated) {
      throw new ServerError({
        message: "Failed to update documents",
      });
    }

    await this.#redis.clearCacheForModel(model);

    if (!options?.session) {
      const cacheKey = this.#redis.getOperationCacheKey({
        model,
        filter,
        operation: "findMultiple",
      });
      this.#redis.set(cacheKey, this.#serializer.toBufferList(updated), this.#module.conf.cache.ttl);
    }

    return updated.map(d => model.hydrate(d));
  }

  async deleteOne<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<true> {
    const { model } = opts;
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const deleted = await this.#mongo.deleteOne({ model, filter, options });

    if (!deleted) {
      throw new ServerError({
        message: "Failed to delete document",
      });
    }

    await this.#redis.clearCacheForModel(model);

    return true;
  }

  async deleteMany<M extends typeof Model>(opts: {
    model: M;
    parsedQuery?: ParsedQuery;
    mergeFilter?: Record<string, any>;
    mergeOptions?: Record<string, any>;
    disableCache?: boolean;
    sessionManager?: SessionManager;
  }): Promise<string[]> {
    const { model } = opts;
    const options = Object.assign({}, opts?.parsedQuery?.options, opts?.mergeOptions);
    const filter = Object.assign({}, opts?.parsedQuery?.filter, opts?.mergeFilter);

    if (opts.sessionManager && !options.session) {
      options.session = await opts.sessionManager.getSessionForModel(opts.model);
    }

    const deletedIds = await this.#mongo.deleteMany({ model, filter, options });

    if (deletedIds.length) {
      await this.#redis.clearCacheForModel(model);
    }

    return deletedIds;
  }
}
