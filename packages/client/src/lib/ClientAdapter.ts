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

  #instancesMap: Map<string, ModelInstance<T>>;
  #cacheSubject: Subject<ModelUpdaterEvent>;
  #eventSubject: Subject<ModelCrudEvent<"create" | "update" | "delete", T>>;

  runValidators = false;

  constructor(data: any) {
    super(data);

    this.#instancesMap = new Map(); // The map of cached instances

    // The subject for cache operations (fetch, create, update, delete).
    // These events are filtered by the cache and are emitted only when the cache is updated.
    // This subject is used to subscribe to local cache updates.
    this.#cacheSubject = new Subject();

    // The subject for all model CRUD events (dispatched locally or received from the server via websockets).
    // These events are not filtered by the cache.
    this.#eventSubject = new Subject();

    this.#eventSubject.subscribe(event => {
      if (!event.ids?.length) {
        return;
      }

      const updater: ModelUpdaterEvent = {
        operation: event.operation,
        ids: event.ids,
      };

      if (event.operation === "create" || event.operation === "update") {
        if (!event.data) {
          return;
        }

        let data = event.data;

        if (event.operation === "create") {
          data = data.filter(r => !this.instancesMap.has(r._id));
        }

        const mappedList = data.map(r => this.mapOrNew(r));
        const updated = mappedList
          .filter(r => r.updated)
          .map(r => r.mapped?._id)
          .filter(Boolean) as Array<string>;

        if (!updated?.length) {
          return;
        }

        updater.ids = updated;
      } else if (event.operation === "delete") {
        event.ids.forEach(id => this.#instancesMap.delete(id));

        updater.ids = event.ids;
      }

      this.#cacheSubject.next(updater);
    });
  }

  checkClient() {
    if (!this.client) {
      throw new ClientError({
        message:
          "Model must be initialized with a client. Please use client.getModel() or client.getAdapterClass() method first",
      });
    }
  }

  fetcher: AdapterFetcher<T> = {
    count: async ([query], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelCount, {
        ctx,
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(query),
        },
      });

      const json: number = await res.json().then(r => r.data);

      return Number(json);
    },
    get: async ([query], ctx) => {
      this.checkClient();

      if (this.model.isSingle()) {
        if (this.#instancesMap.size && !ctx?.disableCache) {
          return this.#instancesMap.values().next()?.value;
        }

        const res = await this.client.execute(controllersMap.modelRead, {
          ctx,
          path: {
            model: this.model.slug,
          },
        });

        const json: ModelJSON<T> = await res.json().then(r => r.data);

        // await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

        const { mapped, updated } = this.mapOrNew(json);

        if (updated && mapped?._id) {
          this.#cacheSubject.next({
            ids: [mapped._id],
            operation: "fetch",
          });
        }

        return mapped;
      }

      if (typeof query === "string") {
        let keyField: string;
        if (!ctx?.disableCache) {
          if (this.#instancesMap.has(query)) {
            return this.#instancesMap.get(query);
          } else if ((keyField = this.model.getKeyField())) {
            const arr = Array.from(this.#instancesMap.values());
            const found = arr.find(r => r.get(keyField) === query);
            if (found) {
              return found;
            }
          }
        }

        const res = await this.client.execute(controllersMap.modelRead, {
          ctx,
          path: {
            id: query,
            model: this.model.slug,
          },
        });

        // await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

        const json: ModelJSON<T> = await res.json().then(r => r.data);

        const { mapped, updated } = this.mapOrNew(json);

        if (updated && mapped?._id) {
          this.#cacheSubject.next({
            ids: [mapped._id],
            operation: "fetch",
          });
        }

        return mapped;
      } else {
        if (canUseIds(query)) {
          return this.fetcher.get([String(query.ids?.[0])], ctx);
        }

        query.pageSize = 1;

        const list = await this.fetcher.getList([query], ctx);

        if (!list?.[0]) {
          return null;
        }

        return list[0];
      }
    },
    getList: async ([query], ctx) => {
      this.checkClient();

      let _fromIdsList: Array<ModelInstance<T>> = [];
      const _canUseIds = canUseIds(query);

      if (_canUseIds && !ctx?.disableCache) {
        const cachedIds = query.ids?.filter(id => this.#instancesMap.has(id)) || [];
        _fromIdsList = cachedIds.map(id => this.#instancesMap.get(id)) as Array<ModelInstance<T>>;

        if (_fromIdsList.length === query.ids?.length) {
          return new ModelList(this.model, _fromIdsList);
        }

        query.ids = query.ids?.filter(id => !cachedIds.includes(id)) as Array<string>;
      }

      const res = await this.client.execute(controllersMap.modelQuery, {
        ctx,
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(query),
        },
      });

      const json: ReturnType<ModelList<T>["toJSON"]> = await res.json().then(r => r.data);

      // await parsePopulated(this.model, res.rows, getPopulatedFromQuery(query));

      const mappedList = json.rows.map(r => this.mapOrNew(r as ModelJSON<T>));
      const mappedRes = mappedList.map(r => r.mapped).filter(Boolean) as Array<ModelInstance<T>>;
      const updated = mappedList
        .filter(r => r.updated)
        .map(r => r.mapped?._id)
        .filter(Boolean) as Array<string>;

      if (updated?.length) {
        this.#cacheSubject.next({
          ids: updated,
          operation: "fetch",
        });
      }

      let count = json.count;
      let list = mappedRes;

      if (_canUseIds) {
        count += _fromIdsList.length;
        list = mappedRes.concat(_fromIdsList).filter(Boolean);
        const ids = query.ids as Array<string>;
        list = list.sort((a, b) => {
          return ids.indexOf(String(a._id)) - ids.indexOf(String(b._id));
        });
      }

      return new ModelList(this.model, list, query, count);
    },
    createOne: async ([payload], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelCreate, {
        ctx,
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(payload),
        },
      });

      const json: ModelJSON<T> = await res.json().then(r => r.data);

      if (json._id) {
        this.dispatch({
          operation: "create",
          model: this.model.slug,
          ids: [json._id],
          data: [json],
        });
      }

      return this.mapOrNew(json).mapped as ModelInstance<T>;
    },
    createMultiple: async ([payload], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelCreate, {
        ctx,
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(payload),
        },
      });

      const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);

      this.dispatch({
        operation: "create",
        model: this.model.slug,
        ids: json.map(r => r._id) as Array<string>,
        data: json,
      });

      return json.map(r => this.mapOrNew(r).mapped).filter(Boolean) as Array<ModelInstance<T>>;
    },
    updateOne: async ([query, update], ctx) => {
      this.checkClient();

      if (typeof query === "string") {
        const res = await this.client.execute(controllersMap.modelUpdate, {
          ctx,
          path: {
            id: query,
            model: this.model.slug,
          },
          init: {
            body: JSON.stringify({ update }),
          },
        });

        const json: ModelJSON<T> = await res.json().then(r => r.data);

        if (json._id) {
          this.dispatch({
            operation: "update",
            model: this.model.slug,
            ids: [json._id],
            data: [json],
          });
        }

        return this.mapOrNew(json).mapped as ModelInstance<T>;
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple([query, update], ctx);

        if (!list) {
          return null;
        }

        const event: ModelCrudEvent<"update", T> = {
          operation: "update",
          model: this.model.slug,
          ids: list.map(l => l._id).filter(Boolean) as Array<string>,
          data: list.map(l => l.toJSON() as ModelJSON<T>),
        };

        this.dispatch(event);

        const first = list?.[0] as ModelInstance<T>;

        if (!first) {
          return null;
        }

        const json = first.toJSON() as ModelJSON<T>;

        return this.mapOrNew(json).mapped as ModelInstance<T>;
      }
    },
    updateMultiple: async ([query, update], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelUpdate, {
        ctx,
        path: {
          id: "",
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify({ ...query, update }),
        },
      });

      const json: Array<ModelJSON<T>> = await res.json().then(r => r.data);

      this.dispatch({
        operation: "update",
        model: this.model.slug,
        ids: json.map(l => l._id) as Array<string>,
        data: json,
      });

      return json.map(r => this.mapOrNew(r).mapped).filter(Boolean) as Array<ModelInstance<T>>;
    },
    deleteOne: async ([query], ctx) => {
      this.checkClient();

      let id: string;

      if (typeof query === "string") {
        const res = await this.client.execute(controllersMap.modelDelete, {
          ctx,
          path: {
            id: query,
            model: this.model.slug,
          },
        });

        const json: boolean = await res.json().then(r => r.data);

        if (!json) {
          return false;
        }

        id = query;
      } else {
        query.pageSize = 1;

        const ids = await this.fetcher.deleteMultiple([query], ctx);

        if (!ids?.length) {
          return false;
        }

        id = String(ids[0]);
      }

      if (id) {
        this.dispatch({
          operation: "delete",
          model: this.model.slug,
          ids: [id],
          data: null,
        });

        this.instancesMap.delete(id);
      }

      return Boolean(id);
    },
    deleteMultiple: async ([query], ctx) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelDelete, {
        ctx,
        path: {
          id: "",
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(query),
        },
      });

      const ids: Array<string> = await res.json().then(r => r.data);

      if (ids?.length) {
        this.dispatch({
          operation: "delete",
          model: this.model.slug,
          ids,
          data: null,
        });

        ids.forEach(id => this.instancesMap.delete(id));
      }

      return ids;
    },
  };

  get client(): Client {
    const { constructor } = Object.getPrototypeOf(this);
    return constructor.client;
  }

  get instancesMap() {
    return this.#instancesMap;
  }

  mapOrNew(payload: ModelJSON<T>) {
    let mapped: ModelInstance<T> | undefined;
    let updated = false;

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload");
    }

    if (payload._id) {
      mapped = this.#instancesMap.get(payload._id);
    }

    if (mapped) {
      const newUpdated = payload._updatedAt && new Date(payload._updatedAt);
      const oldUpdated = mapped._updatedAt;
      if ((newUpdated && !oldUpdated) || (newUpdated && oldUpdated && newUpdated > oldUpdated)) {
        updated = true;
        mapped.setData(payload);
      }
    } else if (payload._id) {
      mapped = this.model.hydrate(payload);
      this.#instancesMap.set(payload._id, mapped);
      updated = true;
    }

    return { updated, mapped };
  }

  subscribe(observer: SubjectObserver<ModelUpdaterEvent>) {
    return this.#cacheSubject.subscribe(observer);
  }

  dispatch(event: ModelCrudEvent<"create" | "update" | "delete", T>) {
    if (this.model.slug !== event.model) {
      throw new ClientError({
        message: `Invalid model ${event.model} for adapter ${this.model.slug}`,
      });
    }

    this.#eventSubject.next(event);
  }

  clearInstances() {
    this.#instancesMap.clear();
  }
}
