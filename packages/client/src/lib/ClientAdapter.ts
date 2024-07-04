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
import Client from "./Client";
import Subject from "./Subject";
import { canUseIds } from "./utils";
import { ModelUpdaterEvent, SubjectObserver } from "../types";
import ClientError from "./ClientError";

class ClientAdapter extends Adapter {
  static client: Client;

  #instancesMap: Map<string, ModelInstance<typeof Model>>;
  #updaterSubject: Subject<ModelUpdaterEvent>;
  #eventSubject: Subject<ModelCrudEvent>;

  runValidators = false;

  constructor(data: any) {
    super(data);

    this.#instancesMap = new Map();
    this.#updaterSubject = new Subject();
    this.#eventSubject = new Subject();

    this.#eventSubject.subscribe(event => {
      if (!event.data) {
        return;
      }

      if (event.operation === "create" || event.operation === "update") {
        const mappedList = event.data.map(r => this.mapOrNew(r));
        const updated = mappedList
          .filter(r => r.updated)
          .map(r => r.mapped?._id)
          .filter(Boolean) as Array<string>;

        if (updated?.length) {
          this.#updaterSubject.next({
            ids: updated,
            operation: event.operation,
          });
        }
      } else if (event.operation === "delete") {
        const updated = event.ids
          .map(_id => {
            if (!this.#instancesMap.has(_id)) {
              return false;
            }

            this.#instancesMap.delete(_id);
            return _id;
          })
          .filter(Boolean) as Array<string>;

        if (updated?.length) {
          this.#updaterSubject.next({
            ids: updated,
            operation: event.operation,
          });
        }
      }
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

  fetcher: AdapterFetcher = {
    count: async ([query]) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelCount, {
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
        if (this.#instancesMap.size) {
          return this.#instancesMap.values().next()?.value;
        }

        const res = await this.client.execute(controllersMap.modelRead, {
          path: {
            model: this.model.slug,
          },
        });

        const json: ModelJSON<typeof Model> = await res.json();

        // await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

        const { mapped, updated } = this.mapOrNew(json);

        if (updated && mapped?._id) {
          this.#updaterSubject.next({
            ids: [mapped._id],
            operation: "fetch",
          });
        }

        return mapped;
      }

      if (typeof query === "string") {
        let keyField: string;
        if (this.#instancesMap.has(query)) {
          return this.#instancesMap.get(query);
        } else if ((keyField = this.model.getKeyField())) {
          const arr = Array.from(this.#instancesMap.values());
          const found = arr.find(r => r.get(keyField) === query);
          if (found) {
            return found;
          }
        }

        const res = await this.client.execute(controllersMap.modelRead, {
          path: {
            id: query,
            model: this.model.slug,
          },
        });

        // await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

        const json: ModelJSON<typeof Model> = await res.json();

        const { mapped, updated } = this.mapOrNew(json);

        if (updated && mapped?._id) {
          this.#updaterSubject.next({
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

      let _fromIdsList: Array<ModelInstance<typeof Model>> = [];
      const _canUseIds = canUseIds(query);

      if (_canUseIds) {
        const existingIds = query.ids?.filter(id => this.#instancesMap.has(id)) as Array<string>;
        _fromIdsList = existingIds.map(id => this.#instancesMap.get(id)) as Array<ModelInstance<typeof Model>>;

        if (_fromIdsList.length === query.ids?.length) {
          return new ModelList(this.model, _fromIdsList);
        }

        query.ids = query.ids?.filter(id => !existingIds.includes(id)) as Array<string>;
      }

      const res = await this.client.execute(controllersMap.modelQuery, {
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(query),
        },
      });

      const json: ReturnType<ModelList<typeof Model>["toJSON"]> = await res.json().then(r => r.data);

      // await parsePopulated(this.model, res.rows, getPopulatedFromQuery(query));

      const mappedList = json.rows.map(r => this.mapOrNew(r));
      const mappedRes = mappedList.map(r => r.mapped).filter(Boolean) as Array<ModelInstance<typeof Model>>;
      const updated = mappedList
        .filter(r => r.updated)
        .map(r => r.mapped?._id)
        .filter(Boolean) as Array<string>;

      if (updated?.length) {
        this.#updaterSubject.next({
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
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(payload),
        },
      });

      const json: ModelJSON<typeof Model> = await res.json().then(r => r.data);

      if (json._id) {
        this.#eventSubject.next({
          operation: "create",
          model: this.model.slug,
          ids: [json._id],
          data: [json],
        });
      }

      return this.mapOrNew(json).mapped as ModelInstance<typeof Model>;
    },
    createMultiple: async ([payload]) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelCreate, {
        path: {
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(payload),
        },
      });

      const json: Array<ModelJSON<typeof Model>> = await res.json().then(r => r.data);

      this.#eventSubject.next({
        operation: "create",
        model: this.model.slug,
        ids: json.map(r => r._id) as Array<string>,
        data: json,
      });

      return json.map(r => this.mapOrNew(r).mapped).filter(Boolean) as Array<ModelInstance<typeof Model>>;
    },
    updateOne: async ([query, update], ctx) => {
      this.checkClient();

      if (typeof query === "string") {
        const res = await this.client.execute(controllersMap.modelUpdate, {
          path: {
            id: query,
            model: this.model.slug,
          },
          init: {
            body: JSON.stringify({ update }),
          },
        });

        const json: ModelJSON<typeof Model> = await res.json().then(r => r.data);

        if (json._id) {
          this.#eventSubject.next({
            operation: "update",
            model: this.model.slug,
            ids: [json._id],
            data: [json],
          });
        }

        return this.mapOrNew(json).mapped as ModelInstance<typeof Model>;
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple([query, update], ctx);

        if (!list) {
          return null;
        }

        const event: ModelCrudEvent = {
          operation: "update",
          model: this.model.slug,
          ids: list.map(l => l._id).filter(Boolean) as Array<string>,
          data: list.map(l => l.toJSON()),
        };

        this.#eventSubject.next(event);

        if (!list?.[0]) {
          return null;
        }

        return this.mapOrNew(list[0].toJSON()).mapped as ModelInstance<typeof Model>;
      }
    },
    updateMultiple: async ([query, update]) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelUpdate, {
        path: {
          id: "",
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify({ ...query, update }),
        },
      });

      const json: Array<ModelJSON<typeof Model>> = await res.json().then(r => r.data);

      this.#eventSubject.next({
        operation: "update",
        model: this.model.slug,
        ids: json.map(l => l._id) as Array<string>,
        data: json,
      });

      return json.map(r => this.mapOrNew(r).mapped).filter(Boolean) as Array<ModelInstance<typeof Model>>;
    },
    deleteOne: async ([query], ctx) => {
      this.checkClient();

      let id: string;

      if (typeof query === "string") {
        const res = await this.client.execute(controllersMap.modelDelete, {
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
        this.#eventSubject.next({
          operation: "delete",
          model: this.model.slug,
          ids: [id],
          data: null,
        });
      }

      return Boolean(id);
    },
    deleteMultiple: async ([query]) => {
      this.checkClient();

      const res = await this.client.execute(controllersMap.modelDelete, {
        path: {
          id: "",
          model: this.model.slug,
        },
        init: {
          body: JSON.stringify(query),
        },
      });

      const json: Array<string> = await res.json().then(r => r.data);

      if (json?.length) {
        this.#eventSubject.next({
          operation: "delete",
          model: this.model.slug,
          ids: json,
          data: null,
        });
      }

      return json;
    },
  };

  get client(): Client {
    const { constructor } = Object.getPrototypeOf(this);
    return constructor.client;
  }

  mapOrNew(payload: ModelJSON<typeof Model>) {
    let mapped: ModelInstance<typeof Model> | undefined;
    let updated = false;

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload");
    }

    if (payload._id) {
      mapped = this.#instancesMap.get(payload._id);
    }

    if (mapped) {
      const newUpdated = payload._updatedAt && new Date(payload._updatedAt);
      const oldUpdated = mapped._updatedAt && new Date(mapped._updatedAt);
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
    return this.#updaterSubject.subscribe(observer);
  }

  dispatch(event: ModelCrudEvent) {
    this.#eventSubject.next(event);
  }
}

export default ClientAdapter;
