import {
  Adapter,
  AdapterFetcher,
  controllersMap,
  Model,
  ModelList,
  ModelCrudEvent,
  ModelInstance,
  ModelJSON,
} from "@graphand/core";
import { Client } from "./Client";
import { Subject } from "./Subject";
import { canUseIds } from "./utils";
import { ModelUpdaterEvent, SubjectObserver } from "@/types";
import { ClientError } from "./ClientError";

export class ClientAdapter<T extends typeof Model = typeof Model> extends Adapter<T> {
  static client: Client;

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

    const mappedList = data.map(r => this.#processInstancePayload(r));
    const updated = mappedList
      .filter(r => r.updated)
      .map(r => r.mapped?._id)
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
      const res = await this.client.execute(controllersMap.modelCount, {
        ctx,
        path: { model: this.model.slug },
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
      return this.#processInstancePayload(json).mapped as ModelInstance<T>;
    },

    createMultiple: async ([payload], ctx) => {
      this.checkClient();
      const json = await this.#createMultipleInternal(payload, ctx);
      return json.map(r => this.#processInstancePayload(r).mapped).filter(Boolean) as Array<ModelInstance<T>>;
    },

    updateOne: async ([query, update], ctx) => {
      this.checkClient();
      return typeof query === "string" ? this.#updateById(query, update, ctx) : this.#updateByQuery(query, update, ctx);
    },

    updateMultiple: async ([query, update], ctx) => {
      this.checkClient();
      const json = await this.#updateMultipleInternal(query, update, ctx);
      return json.map(r => this.#processInstancePayload(r).mapped).filter(Boolean) as Array<ModelInstance<T>>;
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

  async #getSingle(ctx: any): Promise<ModelInstance<T> | null> {
    if (this.#instancesMap.size && !ctx?.disableCache) {
      return this.#instancesMap.values().next().value;
    }
    const res = await this.client.execute(controllersMap.modelRead, {
      ctx,
      path: { model: this.model.slug },
    });
    const json: ModelJSON<T> = await res.json().then(r => r.data);
    return this.#processAndCacheInstance(json);
  }

  async #getById(id: string, ctx: any): Promise<ModelInstance<T> | null> {
    if (!ctx?.disableCache) {
      const cachedInstance = this.#getCachedInstance(id);
      if (cachedInstance) return cachedInstance;
    }
    const res = await this.client.execute(controllersMap.modelRead, {
      ctx,
      path: { id, model: this.model.slug },
    });
    const json: ModelJSON<T> = await res.json().then(r => r.data);
    return this.#processAndCacheInstance(json);
  }

  async #getByQuery(query: any, ctx: any): Promise<ModelInstance<T> | null> {
    if (canUseIds(query)) {
      return this.#getById(String(query.ids?.[0]), ctx);
    }
    query.pageSize = 1;
    const list = await this.#getListInternal(query, ctx);
    return list?.[0] || null;
  }

  async #getListInternal(query: any, ctx: any): Promise<ModelList<T>> {
    let fromIdsList: Array<ModelInstance<T>> = [];
    const canUseIdsForQuery = canUseIds(query);

    if (canUseIdsForQuery && !ctx?.disableCache) {
      fromIdsList = this.#getFromCacheByIds(query.ids);
      if (fromIdsList.length === query.ids?.length) {
        return new ModelList(this.model, fromIdsList);
      }
      query.ids = query.ids?.filter((id: string) => !this.#instancesMap.has(id));
    }

    const res = await this.client.execute(controllersMap.modelQuery, {
      ctx,
      path: { model: this.model.slug },
      init: { body: JSON.stringify(query) },
    });

    const json: ReturnType<ModelList<T>["toJSON"]> = await res.json().then(r => r.data);
    const mappedList = json.rows.map(r => this.#processInstancePayload(r as ModelJSON<T>));
    const mappedRes = mappedList.map(r => r.mapped).filter(Boolean) as Array<ModelInstance<T>>;

    this.#updateCacheFromList(mappedList);

    let count = json.count;
    let list = mappedRes;

    if (canUseIdsForQuery) {
      list = this.#combineAndSortResults(fromIdsList, mappedRes, query.ids);
      count += fromIdsList.length;
    }

    return new ModelList(this.model, list, query, count);
  }

  async #createOneInternal(payload: any, ctx: any): Promise<ModelJSON<T>> {
    const res = await this.client.execute(controllersMap.modelCreate, {
      ctx,
      path: { model: this.model.slug },
      init: { body: JSON.stringify(payload) },
    });

    const json: ModelJSON<T> = await res.json().then(r => r.data);
    this.#dispatchCreateEvent([json]);
    return json;
  }

  async #createMultipleInternal(payload: any, ctx: any): Promise<Array<ModelJSON<T>>> {
    const res = await this.client.execute(controllersMap.modelCreate, {
      ctx,
      path: { model: this.model.slug },
      init: { body: JSON.stringify(payload) },
    });

    const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);
    this.#dispatchCreateEvent(json);
    return json;
  }

  async #updateById(id: string, update: any, ctx: any): Promise<ModelInstance<T> | null> {
    const res = await this.client.execute(controllersMap.modelUpdate, {
      ctx,
      path: { id, model: this.model.slug },
      init: { body: JSON.stringify({ update }) },
    });

    const json: ModelJSON<T> = await res.json().then(r => r.data);
    this.#dispatchUpdateEvent([json]);
    return this.#processInstancePayload(json).mapped as ModelInstance<T>;
  }

  async #updateByQuery(query: any, update: any, ctx: any): Promise<ModelInstance<T> | null> {
    query.pageSize = 1;
    const list = await this.#updateMultipleInternal(query, update, ctx);
    if (!list?.length) return null;
    return this.#processInstancePayload(list[0]).mapped as ModelInstance<T>;
  }

  async #updateMultipleInternal(query: any, update: any, ctx: any): Promise<Array<ModelJSON<T>>> {
    const res = await this.client.execute(controllersMap.modelUpdate, {
      ctx,
      path: { id: "", model: this.model.slug },
      init: { body: JSON.stringify({ ...query, update }) },
    });

    const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);
    this.#dispatchUpdateEvent(json);
    return json;
  }

  async #deleteById(id: string, ctx: any): Promise<boolean> {
    const res = await this.client.execute(controllersMap.modelDelete, {
      ctx,
      path: { id, model: this.model.slug },
    });

    const success: boolean = await res.json().then(r => r.data);
    if (success) {
      this.#dispatchDeleteEvent([id]);
    }
    return success;
  }

  async #deleteByQuery(query: any, ctx: any): Promise<boolean> {
    query.pageSize = 1;
    const ids = await this.#deleteMultipleInternal(query, ctx);
    return ids.length > 0;
  }

  async #deleteMultipleInternal(query: any, ctx: any): Promise<Array<string>> {
    const res = await this.client.execute(controllersMap.modelDelete, {
      ctx,
      path: { id: "", model: this.model.slug },
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

  #updateCacheFromList(mappedList: Array<{ updated: boolean; mapped?: ModelInstance<T> }>): void {
    const updated = mappedList
      .filter(r => r.updated)
      .map(r => r.mapped?._id)
      .filter(Boolean) as Array<string>;

    if (updated.length) {
      this.#cacheSubject.next({
        ids: updated,
        operation: "fetch",
      });
    }
  }

  #combineAndSortResults(
    fromCache: ModelInstance<T>[],
    fromApi: ModelInstance<T>[],
    ids: string[],
  ): ModelInstance<T>[] {
    const combined = [...fromApi, ...fromCache];
    return combined.sort((a, b) => ids.indexOf(String(a._id)) - ids.indexOf(String(b._id)));
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

  #processInstancePayload(payload: ModelJSON<T>): { updated: boolean; mapped?: ModelInstance<T> } {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload");
    }

    let mapped = payload._id ? this.#instancesMap.get(payload._id) : undefined;
    let updated = false;

    if (mapped) {
      const newAge = Math.max(new Date(payload._createdAt ?? 0).getTime(), new Date(payload._updatedAt ?? 0).getTime());
      if (newAge > mapped.__getAge()) {
        updated = true;
        mapped.setData(payload);
      }
    } else if (payload._id) {
      mapped = this.model.hydrate(payload);
      this.#instancesMap.set(payload._id, mapped);
      updated = true;
    }

    if (updated) {
      mapped!.__fetchedAt = new Date();
    }

    return { updated, mapped };
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

  #processAndCacheInstance(json: ModelJSON<T>): ModelInstance<T> | null {
    const { mapped, updated } = this.#processInstancePayload(json);
    if (updated && mapped?._id) {
      this.#cacheSubject.next({
        ids: [mapped._id],
        operation: "fetch",
      });
    }
    return mapped || null;
  }
}
