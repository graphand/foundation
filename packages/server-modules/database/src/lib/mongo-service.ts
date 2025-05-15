import {
  CountDocumentsOptions,
  Document,
  FindOptions,
  InsertOneOptions,
  MongoClient,
  MongoClientOptions,
  MongoServerError,
} from "mongodb";
import {
  JSONObject,
  Model,
  ModelData,
  ValidationError,
  ValidationValidatorError,
  Validator,
  ValidatorTypes,
} from "@graphand/core";
import { ModuleDatabase } from "../module.js";
import { getRequestHelper } from "@graphand/server";

type CustomOptions<T> = T & {
  retryTimes?: number;
  disableCache?: boolean;
};

export class MongoService {
  #client: Promise<MongoClient> | null = null;
  #module: ModuleDatabase;

  constructor(module: ModuleDatabase) {
    this.#module = module;
  }

  parseWriteError(e: any) {
    if (e instanceof MongoServerError && e.code === 11000) {
      const match = e.message.match(/dup key: { (.+): (.+) }/) as any;
      const [, property, value] = match || [];
      const validator = new Validator({
        type: ValidatorTypes.UNIQUE,
        property,
      });

      const err = new ValidationError({
        validators: [new ValidationValidatorError({ validator, value })],
      });

      // @ts-ignore
      err._isMongoError = true;

      return err;
    }

    return e;
  }

  getUri(db?: string) {
    let uri = this.#module.conf.uri;

    if (db) {
      uri = uri.replace(/\/[^/?]*(?=[?]|$)|(?<=\w)(?=[?]|$)/, `/${db}`);
    }

    if (!uri.startsWith("mongodb://")) {
      uri = `mongodb://${uri}`;
    }

    return uri;
  }

  async getClient() {
    if (!this.#client) {
      const uri = this.getUri();
      const options: MongoClientOptions = {
        appName: this.#module.server.appName,
      };
      const { username, password } = this.#module.conf;
      if (username && password) {
        options.authSource = "admin";
        options.auth = { username, password };
      }
      this.#client = MongoClient.connect(uri, options);
    }

    return this.#client;
  }

  getDbName(): string {
    return this.#module.server.appName;
  }

  getDbNameForEnv(env: string): string {
    return `${this.getDbName()}-${env}`;
  }

  getDbNameForModel(model: typeof Model): string {
    if (model.configuration.isEnvironmentScoped) {
      const request = getRequestHelper(model);
      const env = request.getEnvironment();
      return this.getDbNameForEnv(env);
    }

    return this.getDbName();
  }

  async createSession() {
    const client = await this.getClient();
    const session = client.startSession();
    session.startTransaction({
      maxTimeMS: this.#module.conf.mongoMaxTimeMS,
    });
    return session;
  }

  async modelCollection(model: typeof Model) {
    const client = await this.getClient();
    const dbName = this.getDbNameForModel(model);
    const db = client.db(dbName);
    const slug = model.dbSlug || model.configuration.slug;
    return db.collection(slug);
  }

  isRetryableError(
    e: any,
    options?: {
      retryTimes?: number;
    },
  ) {
    if (options?.retryTimes && options.retryTimes > 3) {
      return false;
    }

    if ("NoSuchTransaction" === e.codeName && e.message.includes("aborted")) {
      // delete options.session;
      return false;
    }

    return (
      ["SnapshotUnavailable", "NoSuchTransaction"].includes(e.codeName) ||
      ["MongoNotConnectedError"].includes(e.constructor.name)
    );
  }

  async count(opts: {
    model: typeof Model;
    filter: JSONObject;
    options?: CustomOptions<CountDocumentsOptions>;
  }): Promise<number> {
    const { model, filter } = opts;
    const options = opts.options || {};
    const collection = await this.modelCollection(model);

    try {
      let count: number;

      const maxCount = this.#module.conf.mongoMaxCount;
      const maxTimeMS = this.#module.conf.mongoMaxTimeMS;

      if (filter && Object.keys(filter).length) {
        count = await collection.countDocuments(filter, {
          ...options,
          limit: maxCount,
          maxTimeMS,
        });
      } else {
        count = await collection.estimatedDocumentCount();
      }

      return count > maxCount ? maxCount : count;
    } catch (e) {
      if (this.isRetryableError(e, options)) {
        options.retryTimes ??= 0;
        options.retryTimes += 1;
        return this.count(opts);
      }

      throw e;
    }
  }

  async findOne<M extends typeof Model>(opts: {
    model: M;
    filter: Record<string, any>;
    options?: CustomOptions<FindOptions>;
  }): Promise<ModelData<M> | null> {
    const { model, filter } = opts;
    const options = opts.options || {};
    const collection = await this.modelCollection(model);

    try {
      const doc = await collection.findOne(filter, {
        ...options,
        maxTimeMS: this.#module.conf.mongoMaxTimeMS,
      });

      if (!doc) {
        return null;
      }

      return doc as ModelData<M>;
    } catch (e) {
      if (this.isRetryableError(e, options)) {
        options.retryTimes ??= 0;
        options.retryTimes += 1;
        return this.findOne(opts);
      }

      throw e;
    }
  }

  async findMany<M extends typeof Model>(opts: {
    model: M;
    filter: Record<string, any>;
    options?: CustomOptions<FindOptions>;
  }): Promise<Array<ModelData<M>>> {
    const { model, filter } = opts;
    const options = opts.options || {};
    const collection = await this.modelCollection(model);

    try {
      const documents = await collection
        .find(filter, {
          ...options,
          maxTimeMS: this.#module.conf.mongoMaxTimeMS,
        })
        .toArray();

      return documents as Array<ModelData<M>>;
    } catch (e) {
      if (this.isRetryableError(e, options)) {
        options.retryTimes ??= 0;
        options.retryTimes += 1;
        return this.findMany(opts);
      }

      throw e;
    }
  }

  async insertOne<M extends typeof Model>(opts: {
    model: M;
    document: ModelData<M>;
    options?: CustomOptions<InsertOneOptions>;
  }): Promise<ModelData<M>> {
    const { model, document, options } = opts;
    const collection = await this.modelCollection(model);

    try {
      const res = await collection.insertOne(document as Document, {
        ...options,
        maxTimeMS: this.#module.conf.mongoMaxTimeMS,
      });

      if (!res.insertedId) {
        throw new Error("Failed to insert document");
      }

      const retrieved = await this.findOne({ model, filter: { _id: res.insertedId }, options });

      if (!retrieved) {
        throw new Error("Failed to insert document");
      }

      return retrieved;
    } catch (e) {
      throw this.parseWriteError(e);
    }
  }

  async insertMany<M extends typeof Model>(opts: {
    model: M;
    documents: ModelData<M>[];
    options?: CustomOptions<InsertOneOptions>;
  }): Promise<ModelData<M>[]> {
    const { model, documents, options } = opts;
    const collection = await this.modelCollection(model);

    try {
      const res = await collection.insertMany(documents as Document[], {
        ...options,
        ordered: true,
        maxTimeMS: this.#module.conf.mongoMaxTimeMS,
      });

      if (!res.insertedIds) {
        throw new Error("Failed to insert documents");
      }

      const ids = Object.values(res.insertedIds);
      const retrieved = await this.findMany({ model, filter: { _id: { $in: ids } }, options });

      if (retrieved.length !== ids.length) {
        throw new Error("Failed to insert documents");
      }

      return retrieved;
    } catch (e) {
      throw this.parseWriteError(e);
    }
  }
}
