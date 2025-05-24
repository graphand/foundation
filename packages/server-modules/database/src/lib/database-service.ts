import { JSONObject, Model, ModelData, ModelInstance } from "@graphand/core";
import { ModuleDatabase } from "../module.js";
import { MongoService } from "./mongo-service.js";
import SessionManager from "./session-manager.js";
import { ParsedQuery } from "@/types.js";
import { ServerError } from "@graphand/server";

export class DatabaseService {
  #module: ModuleDatabase;
  #mongo: MongoService;

  constructor(module: ModuleDatabase) {
    this.#module = module;
    this.#mongo = new MongoService(module);
  }

  async init() {
    await this.#mongo.getClient();
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

    // const cacheEnabled = !opts.disableCache && !model.disableCache && this.#cacheStrategy.isReady();
    // const cacheKey =
    //   cacheEnabled &&
    //   this.getOperationCacheKey({
    //     model,
    //     filter,
    //     options,
    //     operation: "count",
    //   });

    // if (cacheEnabled) {
    //   const cached = await this.#cacheStrategy.get(cacheKey);
    //   if (cached) {
    //     return parseInt(cached.toString());
    //   }
    // }

    const count = await this.#mongo.count({ model: opts.model, filter, options });

    // if (cacheEnabled && !options.session) {
    //   this.#cacheStrategy.set(cacheKey, Buffer.from(count.toString()), cacheDataTTL);
    // }

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

    // const cacheEnabled = !opts.disableCache && !model.disableCache && this.#cacheStrategy.isReady();
    // const cacheKey =
    //   cacheEnabled &&
    //   this.getOperationCacheKey({
    //     model,
    //     filter,
    //     options,
    //     operation: "findDocument",
    //   });

    // if (cacheEnabled) {
    //   const cached = await this.#cacheStrategy.get(cacheKey);
    //   if (cached) {
    //     return ModelService.get(model).fromBuffer(cached) as InferModelDef<M, "data">;
    //   }
    // }

    const document = await this.#mongo.findOne({ model: opts.model, filter, options });

    // if (cacheEnabled && !options.session) {
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBuffer(document), cacheDataTTL);
    // }

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

    // const cacheEnabled = !opts.disableCache && !model.disableCache && this.#cacheStrategy.isReady();
    // const cacheKey =
    //   cacheEnabled &&
    //   this.getOperationCacheKey({
    //     model,
    //     filter,
    //     options,
    //     operation: "findMultiple",
    //   });

    // if (cacheEnabled) {
    //   const cached = await this.#cacheStrategy.get(cacheKey);
    //   if (cached) {
    //     return ModelService.get(model).fromBufferList(cached) as Array<InferModelDef<M, "data">>;
    //   }
    // }

    const documents = await this.#mongo.findMany({ model, filter, options });

    // if (cacheEnabled && !options.session) {
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBufferList(documents), cacheDataTTL);
    // }

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

    // await this.clearCacheForModel(model);

    // if (!options?.session) {
    //   const cacheKey = this.getOperationCacheKey({
    //     model,
    //     filter: { _id: inserted._id },
    //     operation: "findDocument",
    //   });
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBuffer(inserted), cacheDataTTL);
    // }

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

    // await this.clearCacheForModel(model);

    // if (!options?.session) {
    //   const cacheKey = this.getOperationCacheKey({
    //     model,
    //     filter: { _id: { $in: inserted.map(d => d._id) } },
    //     operation: "findMultiple",
    //   });
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBufferList(inserted), cacheDataTTL);
    // }

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

    // await this.clearCacheForModel(model);

    // if (!options?.session) {
    //   const cacheKey = this.getOperationCacheKey({
    //     model,
    //     filter,
    //     operation: "findDocument",
    //   });
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBuffer(updated), cacheDataTTL);
    // }

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

    // await this.clearCacheForModel(model);

    // if (!options?.session) {
    //   const cacheKey = this.getOperationCacheKey({
    //     model,
    //     filter,
    //     operation: "findMultiple",
    //   });
    //   this.#cacheStrategy.set(cacheKey, ModelService.get(model).toBufferList(updated), cacheDataTTL);
    // }

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

    // await this.clearCacheForModel(model);

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

    // if (deletedIds.length) {
    //   await this.clearCacheForModel(model);
    // }

    return deletedIds;
  }
}
