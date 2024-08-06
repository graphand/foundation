import "../augmentations";
import {
  Adapter,
  AdapterFetcher,
  Model,
  ModelList,
  ModelCrudEvent,
  ModelInstance,
  ModelJSON,
  FieldTypes,
  getNestedFieldsArrayForModel,
  getFieldsPathsFromPath,
  FieldOptionsMap,
  Field,
  JSONQuery,
  TransactionCtx,
  FieldsDefinition,
  controllerModelCount,
  controllerModelRead,
  controllerModelQuery,
  controllerModelCreate,
  controllerModelUpdate,
  controllerModelDelete,
} from "@graphand/core";
import { Client } from "./Client";
import { Subject } from "./Subject";
import { canUseIds } from "./utils";
import { ModelUpdaterEvent, SubjectObserver } from "@/types";
import { ClientError } from "./ClientError";
import FieldRelation from "./fields/Relation";
import FieldArray from "./fields/Array";

export class ClientAdapter<T extends typeof Model = typeof Model> extends Adapter<T> {
  static client: Client;

  static fieldsMap = {
    [FieldTypes.RELATION]: FieldRelation,
    [FieldTypes.ARRAY]: FieldArray,
  };

  #instancesMap: Map<string, ModelInstance<T>> = new Map();
  #cacheSubject: Subject<ModelUpdaterEvent> = new Subject();
  #eventSubject: Subject<ModelCrudEvent<"create" | "update" | "delete", T>> = new Subject();

  runValidators = false;

  constructor(data: any) {
    super(data);

    this.#setupEventSubscription();
  }

  #setupEventSubscription(): void {
    this.#eventSubject.subscribe(event => {
      if (!event.ids?.length) return;

      const updater: ModelUpdaterEvent = { operation: event.operation, ids: event.ids };

      switch (event.operation) {
        case "create":
        case "update":
          this.#handleCreateOrUpdate(event as ModelCrudEvent<"create" | "update", T>, updater);
          break;
        case "delete":
          this.#handleDelete(event as ModelCrudEvent<"delete", T>, updater);
          break;
      }

      if (updater.ids?.length) {
        this.#cacheSubject.next(updater);
      }
    });
  }

  #handleCreateOrUpdate(event: ModelCrudEvent<"create" | "update", T>, updater: ModelUpdaterEvent): void {
    if (!event.data) return;

    const data = event.operation === "create" ? event.data.filter(r => !this.#instancesMap.has(r._id)) : event.data;

    const instanceList = data.map(r => this.processInstancePayload(r));
    const updated = instanceList
      .filter(r => r.updated)
      .map(r => r.instance?._id)
      .filter(Boolean) as Array<string>;

    if (updated.length) {
      updater.ids = updated;
    }
  }

  #handleDelete(event: ModelCrudEvent<"delete", T>, updater: ModelUpdaterEvent): void {
    const ids = event.ids.filter(id => this.#instancesMap.has(id));
    ids.forEach(id => this.#instancesMap.delete(id));
    updater.ids = ids;
  }

  checkClient(): void {
    if (!this.client) {
      throw new ClientError({
        message:
          "Model must be initialized with a client. Please use client.getModel() or client.getAdapterClass() method first",
      });
    }
  }

  get client(): Client {
    return (this.constructor as typeof ClientAdapter).client;
  }

  get instancesMap(): Map<string, ModelInstance<T>> {
    return this.#instancesMap;
  }

  fetcher: AdapterFetcher<T> = {
    count: async ([query], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllerModelCount, {
        ctx,
        params: { model: this.model.slug },
        init: { body: JSON.stringify(query) },
      });

      return Number(await res.json().then(r => r.data));
    },

    get: async ([query], ctx) => {
      this.checkClient();

      if (this.model.isSingle()) {
        return this.#getSingle(ctx);
      }

      return typeof query === "string" ? this.#getById(query, ctx) : this.#getByQuery(query, ctx);
    },

    getList: async ([query], ctx) => {
      this.checkClient();

      return this.#getListInternal(query, ctx);
    },

    createOne: async ([payload], ctx) => {
      this.checkClient();

      const json = await this.#createOneInternal(payload, ctx);
      return this.processInstancePayload(json).instance as ModelInstance<T>;
    },

    createMultiple: async ([payload], ctx) => {
      this.checkClient();

      const json = await this.#createMultipleInternal(payload, ctx);
      return json.map(r => this.processInstancePayload(r).instance).filter(Boolean) as Array<ModelInstance<T>>;
    },

    updateOne: async ([query, update], ctx) => {
      this.checkClient();

      return typeof query === "string" ? this.#updateById(query, update, ctx) : this.#updateByQuery(query, update, ctx);
    },

    updateMultiple: async ([query, update], ctx) => {
      this.checkClient();

      const json = await this.#updateMultipleInternal(query, update, ctx);
      return json.map(r => this.processInstancePayload(r).instance).filter(Boolean) as Array<ModelInstance<T>>;
    },

    deleteOne: async ([query], ctx) => {
      this.checkClient();

      return typeof query === "string" ? this.#deleteById(query, ctx) : this.#deleteByQuery(query, ctx);
    },

    deleteMultiple: async ([query], ctx) => {
      this.checkClient();

      return this.#deleteMultipleInternal(query, ctx);
    },
  };

  async #getSingle(ctx: TransactionCtx): Promise<ModelInstance<T> | null> {
    if (this.#instancesMap.size && !ctx?.disableCache) {
      return this.#instancesMap.values().next().value;
    }
    const res = await this.client.execute(controllerModelRead, {
      ctx,
      params: { model: this.model.slug },
    });
    const json: ModelJSON<T> = await res.json().then(r => r.data);
    await this.#initPopulatedModels(json);
    return this.processAndCacheInstance(json);
  }

  async #getById(id: string, ctx: TransactionCtx): Promise<ModelInstance<T> | null> {
    if (!ctx?.disableCache) {
      const cachedInstance = this.#getCachedInstance(id);
      if (cachedInstance) return cachedInstance;
    }
    const res = await this.client.execute(controllerModelRead, {
      ctx,
      params: { id, model: this.model.slug },
    });
    const json: ModelJSON<T> = await res.json().then(r => r.data);
    await this.#initPopulatedModels(json);
    return this.processAndCacheInstance(json);
  }

  async #getByQuery(query: JSONQuery, ctx: TransactionCtx): Promise<ModelInstance<T> | null> {
    if (canUseIds(query)) {
      return this.#getById(String(query.ids?.[0]), ctx);
    }
    query.pageSize = 1;
    const list = await this.#getListInternal(query, ctx);
    return list?.[0] || null;
  }

  async #getListInternal(query: JSONQuery, ctx: TransactionCtx): Promise<ModelList<T>> {
    let fromIdsList: Array<ModelInstance<T>> = [];
    const canUseIdsForQuery = canUseIds(query);

    if (canUseIdsForQuery && !ctx?.disableCache) {
      fromIdsList = this.#getFromCacheByIds(query.ids);
      if (fromIdsList.length === query.ids?.length) {
        return new ModelList(this.model, fromIdsList);
      }
      query.ids = query.ids?.filter((id: string) => !this.#instancesMap.has(id));
    }

    const res = await this.client.execute(controllerModelQuery, {
      ctx,
      params: { model: this.model.slug },
      data: query,
    });

    const json: ReturnType<ModelList<T>["toJSON"]> = await res.json().then(r => r.data);
    await this.#initPopulatedModels(json.rows as Array<ModelJSON<T>>);
    const instanceList = json.rows.map(r => this.processInstancePayload(r as ModelJSON<T>));
    const instanceRes = instanceList.map(r => r.instance).filter(Boolean) as Array<ModelInstance<T>>;

    this.#updateCacheFromList(instanceList);

    let count = json.count;
    let list = instanceRes;

    if (canUseIdsForQuery) {
      const combined = [...fromIdsList, ...instanceRes];
      list = combined.sort((a, b) => query.ids.indexOf(String(a._id)) - query.ids.indexOf(String(b._id)));
      count += fromIdsList.length;
    }

    return new ModelList(this.model, list, query, count);
  }

  async #createOneInternal(payload: any, ctx: TransactionCtx): Promise<ModelJSON<T>> {
    const res = await this.client.execute(controllerModelCreate, {
      ctx,
      params: { model: this.model.slug },
      data: payload,
    });

    const json: ModelJSON<T> = await res.json().then(r => r.data);
    this.#dispatchCreateEvent([json]);
    return json;
  }

  async #createMultipleInternal(payload: any, ctx: TransactionCtx): Promise<Array<ModelJSON<T>>> {
    const res = await this.client.execute(controllerModelCreate, {
      ctx,
      params: { model: this.model.slug },
      data: payload,
    });

    const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);
    this.#dispatchCreateEvent(json);
    return json;
  }

  async #updateById(id: string, update: any, ctx: TransactionCtx): Promise<ModelInstance<T> | null> {
    const res = await this.client.execute(controllerModelUpdate, {
      ctx,
      params: { id, model: this.model.slug },
      data: { update },
    });

    const json: ModelJSON<T> = await res.json().then(r => r.data);
    this.#dispatchUpdateEvent([json]);
    return this.processInstancePayload(json).instance as ModelInstance<T>;
  }

  async #updateByQuery(query: JSONQuery, update: any, ctx: TransactionCtx): Promise<ModelInstance<T> | null> {
    query.pageSize = 1;
    const list = await this.#updateMultipleInternal(query, update, ctx);
    if (!list?.length) return null;
    return this.processInstancePayload(list[0]).instance as ModelInstance<T>;
  }

  async #updateMultipleInternal(query: JSONQuery, update: any, ctx: TransactionCtx): Promise<Array<ModelJSON<T>>> {
    const res = await this.client.execute(controllerModelUpdate, {
      ctx,
      params: { id: "", model: this.model.slug },
      data: { ...query, update },
    });

    const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);
    this.#dispatchUpdateEvent(json);
    return json;
  }

  async #deleteById(id: string, ctx: TransactionCtx): Promise<boolean> {
    const res = await this.client.execute(controllerModelDelete, {
      ctx,
      params: { id, model: this.model.slug },
    });

    const success: boolean = await res.json().then(r => r.data);
    if (success) {
      this.#dispatchDeleteEvent([id]);
    }
    return success;
  }

  async #deleteByQuery(query: JSONQuery, ctx: TransactionCtx): Promise<boolean> {
    query.pageSize = 1;
    const ids = await this.#deleteMultipleInternal(query, ctx);
    return ids.length > 0;
  }

  async #deleteMultipleInternal(query: JSONQuery, ctx: TransactionCtx): Promise<Array<string>> {
    const res = await this.client.execute(controllerModelDelete, {
      ctx,
      params: { id: "", model: this.model.slug },
      init: { body: JSON.stringify(query) },
    });

    const ids: Array<string> = await res.json().then(r => r.data);
    if (ids?.length) {
      this.#dispatchDeleteEvent(ids);
    }
    return ids;
  }

  #getFromCacheByIds(ids: string[]): Array<ModelInstance<T>> {
    return ids.filter(id => this.#instancesMap.has(id)).map(id => this.#instancesMap.get(id)!);
  }

  #updateCacheFromList(instanceList: Array<{ updated: boolean; instance?: ModelInstance<T> }>): void {
    const updated = instanceList
      .filter(r => r.updated)
      .map(r => r.instance?._id)
      .filter(Boolean) as Array<string>;

    if (updated.length) {
      this.#cacheSubject.next({
        ids: updated,
        operation: "fetch",
      });
    }
  }

  #dispatchCreateEvent(data: ModelJSON<T>[]): void {
    this.dispatch({
      operation: "create",
      model: this.model.slug,
      ids: data.map(item => item._id) as string[],
      data,
    });
  }

  #dispatchUpdateEvent(data: ModelJSON<T>[]): void {
    this.dispatch({
      operation: "update",
      model: this.model.slug,
      ids: data.map(item => item._id) as string[],
      data,
    });
  }

  #dispatchDeleteEvent(ids: string[]): void {
    this.dispatch({
      operation: "delete",
      model: this.model.slug,
      ids,
      data: null,
    });
  }

  processInstancePayload(payload: ModelJSON<T>): { updated: boolean; instance?: ModelInstance<T> } {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload");
    }

    let instance = payload._id ? this.#instancesMap.get(payload._id) : undefined;
    let updated = false;

    payload = this.#processPopulatedData(payload);

    if (instance) {
      const newAge = Math.max(new Date(payload._createdAt ?? 0).getTime(), new Date(payload._updatedAt ?? 0).getTime());
      if (newAge > instance.__getAge()) {
        instance.setData(payload);
        updated = true;
      }
    } else if (payload._id) {
      instance = this.model.hydrate(payload);
      this.#instancesMap.set(payload._id, instance);
      updated = true;
    }

    if (updated) {
      instance.__fetchedAt = new Date();
    }

    return { updated, instance };
  }

  async #initPopulatedModels(payload: ModelJSON<T> | Array<ModelJSON<T>>): Promise<void> {
    const modelsToInitialize: Set<typeof Model> = new Set();

    const collectModels = (obj: any, model: typeof Model) => {
      const fields = getNestedFieldsArrayForModel(model);

      for (const field of fields) {
        const fieldsPaths = getFieldsPathsFromPath(model, field.path).filter(Boolean);
        let current = obj;

        for (const { field: currentField, key } of fieldsPaths) {
          if (current?.[key] === undefined) break;

          if (currentField.type === FieldTypes.ARRAY) {
            const arrayOptions = currentField.options as FieldOptionsMap[FieldTypes.ARRAY];
            if (Array.isArray(current[key])) {
              if (arrayOptions?.items?.type === FieldTypes.RELATION) {
                const refModel = this.client.getModel((arrayOptions.items.options as any).ref);
                modelsToInitialize.add(refModel);
                current[key].forEach((item: any) => {
                  if (typeof item === "object" && item !== null) {
                    collectModels(item, refModel);
                  }
                });
              } else if (arrayOptions?.items?.type === FieldTypes.NESTED) {
                current[key].forEach((item: any) => {
                  collectModels(item, model);
                });
              }
            }
            break;
          } else if (currentField.type === FieldTypes.RELATION) {
            if (typeof current[key] === "object" && current[key] !== null) {
              const refModel = this.client.getModel((currentField.options as any).ref);
              modelsToInitialize.add(refModel);
              collectModels(current[key], refModel);
            }
            break;
          } else if (currentField.type === FieldTypes.NESTED) {
            if (typeof current[key] === "object" && current[key] !== null) {
              collectModels(current[key], model);
            }
            break;
          }

          current = current[key];
        }
      }
    };

    if (Array.isArray(payload)) {
      payload.forEach(p => collectModels(p, this.model));
    } else {
      collectModels(payload, this.model);
    }

    // Initialize all collected models
    await Promise.all(Array.from(modelsToInitialize).map(m => m.initialize()));
  }

  #processPopulatedData(payload: ModelJSON<T>): ModelJSON<T> {
    const relationFields = getNestedFieldsArrayForModel(this.model).filter(f => f.type === FieldTypes.RELATION);

    if (!relationFields.length) {
      return payload;
    }

    const processRelationField = (data: any, field: Field): any => {
      const fieldsPaths = getFieldsPathsFromPath(this.model, field.path);
      let current = data;

      for (const { field: currentField, key } of fieldsPaths) {
        if (current?.[key] === undefined) break;

        if (currentField.type === FieldTypes.ARRAY) {
          const arrayOptions = currentField.options as FieldOptionsMap[FieldTypes.ARRAY];
          if (Array.isArray(current[key])) {
            if (arrayOptions?.items?.type === FieldTypes.RELATION) {
              const refModel = this.client.getModel((arrayOptions.items.options as any).ref);
              const adapter = refModel.getAdapter() as ClientAdapter;
              current[key] = current[key].map((item: any) =>
                typeof item === "object" && item !== null ? adapter.processInstancePayload(item).instance._id : item,
              );
            } else if (arrayOptions?.items?.type === FieldTypes.NESTED) {
              const nestedOptions = arrayOptions.items.options as FieldOptionsMap[FieldTypes.NESTED];
              current[key] = current[key].map((item: any) => this.#processNestedObject(item, nestedOptions?.fields));
            }
          }
          break;
        } else if (currentField.type === FieldTypes.RELATION) {
          if (typeof current[key] === "object" && current[key] !== null) {
            const refModel = this.client.getModel((currentField.options as any).ref);
            const adapter = refModel.getAdapter() as ClientAdapter;
            current[key] = adapter.processInstancePayload(current[key]).instance._id;
          }
          break;
        } else if (currentField.type === FieldTypes.NESTED) {
          const nestedOptions = currentField.options as FieldOptionsMap[FieldTypes.NESTED];
          if (typeof current[key] === "object" && current[key] !== null) {
            current[key] = this.#processNestedObject(current[key], nestedOptions?.fields);
          }
          break;
        }

        current = current[key];
      }

      return data;
    };

    const processObject = (obj: any): any => {
      if (typeof obj !== "object" || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(processObject);
      }

      const processedObj = obj;
      for (const field of relationFields) {
        processRelationField(processedObj, field);
      }

      for (const key in processedObj) {
        processedObj[key] = processObject(processedObj[key]);
      }

      return processedObj;
    };

    return processObject(payload);
  }

  #processNestedObject(obj: any, fields?: FieldsDefinition): any {
    if (!fields) return obj;

    const processedObj = obj;
    for (const [key, field] of Object.entries(fields)) {
      if (field.type === FieldTypes.RELATION) {
        if (typeof processedObj[key] === "object" && processedObj[key] !== null) {
          const refModel = this.client.getModel((field.options as any).ref);
          const adapter = refModel.getAdapter() as ClientAdapter;
          processedObj[key] = adapter.processInstancePayload(processedObj[key]).instance._id;
        }
      } else if (field.type === FieldTypes.ARRAY) {
        const arrayOptions = field.options as FieldOptionsMap[FieldTypes.ARRAY];
        if (Array.isArray(processedObj[key])) {
          if (arrayOptions?.items?.type === FieldTypes.RELATION) {
            const refModel = this.client.getModel((arrayOptions.items.options as any).ref);
            const adapter = refModel.getAdapter() as ClientAdapter;
            processedObj[key] = processedObj[key].map((item: any) =>
              typeof item === "object" && item !== null ? adapter.processInstancePayload(item).instance._id : item,
            );
          } else if (arrayOptions?.items?.type === FieldTypes.NESTED) {
            const nestedOptions = arrayOptions.items.options as FieldOptionsMap[FieldTypes.NESTED];
            processedObj[key] = processedObj[key].map((item: any) =>
              this.#processNestedObject(item, nestedOptions?.fields),
            );
          }
        }
      } else if (field.type === FieldTypes.NESTED) {
        if (typeof processedObj[key] === "object" && processedObj[key] !== null) {
          const nestedOptions = field.options as FieldOptionsMap[FieldTypes.NESTED];
          processedObj[key] = this.#processNestedObject(processedObj[key], nestedOptions?.fields);
        }
      }
    }
    return processedObj;
  }

  subscribe(observer: SubjectObserver<ModelUpdaterEvent>): () => void {
    return this.#cacheSubject.subscribe(observer);
  }

  dispatch(event: ModelCrudEvent<"create" | "update" | "delete", T>): void {
    if (this.model.slug !== event.model) {
      throw new ClientError({
        message: `Invalid model ${event.model} for adapter ${this.model.slug}`,
      });
    }

    this.#eventSubject.next(event);
  }

  clearInstances(): void {
    this.#instancesMap.clear();
  }

  #getCachedInstance(id: string): ModelInstance<T> | undefined {
    if (this.#instancesMap.has(id)) {
      return this.#instancesMap.get(id);
    }

    const keyField = this.model.getKeyField();
    if (keyField) {
      return Array.from(this.#instancesMap.values()).find(instance => instance.get(keyField) === id);
    }

    return undefined;
  }

  processAndCacheInstance(json: ModelJSON<T>): ModelInstance<T> | null {
    const { instance, updated } = this.processInstancePayload(json);

    if (updated && instance?._id) {
      this.#cacheSubject.next({
        ids: [instance._id],
        operation: "fetch",
      });
    }

    return instance || null;
  }
}
