import {
  Adapter,
  AdapterFetcher,
  controllersMap,
  Model,
  ModelList,
  ModelCrudEvent,
} from "@graphand/core";
import Client from "./Client";
import Subject from "./Subject";
import {
  canUseIds,
  executeController,
  getPopulatedFromQuery,
  parsePopulated,
} from "./utils";
import { ModelUpdaterEvent } from "../types";
import ClientError from "./ClientError";
import ErrorCodes from "../enums/error-codes";

class ClientAdapter extends Adapter {
  static __client: Client;
  __instancesMap: Map<string, Model>;
  __updaterSubject: Subject<ModelUpdaterEvent>;
  __eventSubject: Subject<ModelCrudEvent>;
  __queriesMap: Map<string, Promise<any>>;

  runValidators = false;

  constructor(data) {
    super(data);

    this.__eventSubject = new Subject();

    this.__eventSubject.subscribe((event) => {
      this.queriesMap.clear();

      if (event.operation === "create" || event.operation === "update") {
        const mappedList = event.data.map((r) => this.mapOrNew(r));
        const updated = mappedList
          .filter((r) => r.updated)
          .map((r) => r.mapped._id);

        if (updated?.length) {
          this.updaterSubject.next({
            ids: updated,
            operation: event.operation,
          });
        }
      } else if (event.operation === "delete") {
        let updated = event.ids
          .map((_id) => {
            if (!this.instancesMap.has(_id)) {
              return false;
            }

            this.instancesMap.delete(_id);
            return _id;
          })
          .filter(Boolean) as Array<string>;

        if (updated?.length) {
          this.updaterSubject.next({
            ids: updated,
            operation: event.operation,
          });
        }
      }
    });
  }

  fetcher: AdapterFetcher = {
    count: async ([query]) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const cacheKey = "count:" + JSON.stringify(query);
      let resPromise = this.queriesMap.get(cacheKey);

      resPromise = (async () => {
        return await executeController(this.client, controllersMap.modelCount, {
          path: {
            model: this.model.slug,
          },
          body: query,
        });
      })();

      this.queriesMap.set(cacheKey, resPromise);
      return resPromise;
    },
    get: async ([query], ctx) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const cacheKey = "get:" + JSON.stringify(query);
      let resPromise = this.queriesMap.get(cacheKey);

      if (resPromise) {
        return resPromise;
      }

      resPromise = (async () => {
        if (this.model.single) {
          if (this.instancesMap.size) {
            return this.instancesMap.values().next()?.value;
          }

          const res = await executeController(
            this.client,
            controllersMap.modelRead,
            {
              path: {
                model: this.model.slug,
              },
            }
          );

          if (!res) {
            return null;
          }

          await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

          const { mapped, updated } = this.mapOrNew(res);

          if (updated) {
            this.updaterSubject.next({
              ids: [mapped._id],
              operation: "fetch",
            });
          }

          return mapped;
        }

        if (typeof query === "string") {
          if (this.instancesMap.has(query)) {
            return this.instancesMap.get(query);
          } else if (this.model.keyField) {
            const arr = Array.from(this.instancesMap.values());
            const found = arr.find((r) => r[this.model.keyField] === query);
            if (found) {
              return found;
            }
          }

          const res = await executeController(
            this.client,
            controllersMap.modelRead,
            {
              path: {
                id: query,
                model: this.model.slug,
              },
            }
          );

          if (!res) {
            return null;
          }

          await parsePopulated(this.model, [res], getPopulatedFromQuery(query));

          const { mapped, updated } = this.mapOrNew(res);

          if (updated) {
            this.updaterSubject.next({
              ids: [mapped._id],
              operation: "fetch",
            });
          }

          return mapped;
        } else {
          if (canUseIds(query)) {
            return this.fetcher.get([query.ids[0]], ctx);
          }

          query.pageSize = 1;

          const list = await this.fetcher.getList([query], ctx);

          if (!list?.[0]) {
            return null;
          }

          return list[0];
        }
      })();

      this.queriesMap.set(cacheKey, resPromise);
      return resPromise;
    },
    getList: async ([query], ctx) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const cacheKey = "getList:" + JSON.stringify(query);
      let resPromise = this.queriesMap.get(cacheKey);

      if (resPromise) {
        return resPromise;
      }

      resPromise = (async () => {
        const _canUseIds = canUseIds(query) as Array<string>;
        let _fromIdsList: Array<Model> = [];

        if (_canUseIds) {
          const existingIds = query.ids.filter((id) =>
            this.instancesMap.has(id)
          );
          _fromIdsList = existingIds.map((id) => this.instancesMap.get(id));

          if (_fromIdsList.length === query.ids.length) {
            return new ModelList(this.model, _fromIdsList);
          }

          query.ids = query.ids.filter((id) => !this.instancesMap.has(id));
        }

        const res = await executeController(
          this.client,
          controllersMap.modelQuery,
          {
            path: {
              model: this.model.slug,
            },
            body: query,
          }
        );

        await parsePopulated(
          this.model,
          res.rows,
          getPopulatedFromQuery(query)
        );

        const mappedList = res.rows.map((r) => this.mapOrNew(r));
        const mappedRes = mappedList.map((r) => r.mapped);
        const updated = mappedList
          .filter((r) => r.updated)
          .map((r) => r.mapped._id);

        if (updated?.length) {
          this.updaterSubject.next({
            ids: updated,
            operation: "fetch",
          });
        }

        let count = res.count;
        let list = mappedRes;

        if (_canUseIds) {
          count += _fromIdsList.length;
          list = mappedRes.concat(_fromIdsList);
          list = list.sort((a, b) => {
            return _canUseIds.indexOf(a._id) - _canUseIds.indexOf(b._id);
          });
        }

        return new ModelList(this.model, list, query, count);
      })();

      this.queriesMap.set(cacheKey, resPromise);
      return await resPromise;
    },
    createOne: async ([payload], ctx) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const res = await executeController(
        this.client,
        controllersMap.modelCreate,
        {
          path: {
            model: this.model.slug,
          },
          body: payload,
          sendAsFormData: ctx?.sendAsFormData,
        }
      );

      this.__eventSubject.next({
        operation: "create",
        model: this.model.slug,
        ids: [res._id],
        data: [res],
      } as ModelCrudEvent);

      return this.mapOrNew(res).mapped;
    },
    createMultiple: async ([payload]) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const res = await executeController(
        this.client,
        controllersMap.modelCreate,
        {
          path: {
            model: this.model.slug,
          },
          body: payload,
        }
      );

      this.__eventSubject.next({
        operation: "create",
        model: this.model.slug,
        ids: res.map((r) => r._id),
        data: res,
      } as ModelCrudEvent);

      return res.map((r) => this.mapOrNew(r).mapped);
    },
    updateOne: async ([query, update], ctx) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      if (typeof query === "string") {
        const res = await executeController(
          this.client,
          controllersMap.modelUpdate,
          {
            path: {
              id: query,
              model: this.model.slug,
            },
            body: { update },
          }
        );

        this.__eventSubject.next({
          operation: "update",
          model: this.model.slug,
          ids: [res._id],
          data: [res],
        } as ModelCrudEvent);

        return this.mapOrNew(res).mapped;
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple([query, update], ctx);

        if (!list) {
          return null;
        }

        this.__eventSubject.next({
          operation: "update",
          model: this.model.slug,
          ids: list.map((l) => l._id),
          data: list,
        } as ModelCrudEvent);

        return this.mapOrNew(list[0]).mapped;
      }
    },
    updateMultiple: async ([query, update]) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const res = await executeController(
        this.client,
        controllersMap.modelUpdate,
        {
          path: {
            id: "",
            model: this.model.slug,
          },
          body: { ...query, update },
        }
      );

      this.__eventSubject.next({
        operation: "update",
        model: this.model.slug,
        ids: res.map((l) => l._id),
        data: res,
      } as ModelCrudEvent);

      return res.map((r) => this.mapOrNew(r).mapped);
    },
    deleteOne: async ([query], ctx) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      let res;

      if (typeof query === "string") {
        res = await executeController(this.client, controllersMap.modelDelete, {
          path: {
            id: query,
            model: this.model.slug,
          },
        });
      } else {
        query.pageSize = 1;

        res = await this.fetcher.deleteMultiple([query], ctx);
      }

      this.__eventSubject.next({
        operation: "delete",
        model: this.model.slug,
        ids: res,
      } as ModelCrudEvent);

      return Boolean(res?.length);
    },
    deleteMultiple: async ([query]) => {
      if (!this.client) {
        throw new ClientError({
          code: ErrorCodes.MODEL_NO_CLIENT,
          message:
            "Model must be initialized with a client. Please use client.getModel() method first",
        });
      }

      const res = await executeController(
        this.client,
        controllersMap.modelDelete,
        {
          path: {
            id: "",
            model: this.model.slug,
          },
          body: query,
        }
      );

      this.__eventSubject.next({
        operation: "delete",
        model: this.model.slug,
        ids: res.map((l) => l._id),
      } as ModelCrudEvent);

      return res;
    },
  };

  static get client() {
    return this.__client;
  }

  get client() {
    const { constructor } = Object.getPrototypeOf(this);
    return constructor.__client;
  }

  get instancesMap() {
    this.__instancesMap ??= new Map();
    return this.__instancesMap;
  }

  get updaterSubject() {
    this.__updaterSubject ??= new Subject();
    return this.__updaterSubject;
  }

  get queriesMap() {
    this.__queriesMap ??= new Map();
    return this.__queriesMap;
  }

  mapOrNew(payload: any) {
    let mapped;
    let updated = false;

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload");
    }

    if (payload._id) {
      mapped = this.instancesMap.get(payload._id);
    }

    if (mapped) {
      if (
        (payload._updatedAt && !mapped._updatedAt) ||
        new Date(payload._updatedAt) > new Date(mapped._updatedAt)
      ) {
        updated = true;
        mapped.__doc = payload;
      }
    } else {
      mapped = new this.model(payload);
      this.instancesMap.set(payload._id, mapped);
      updated = true;
    }

    return { updated, mapped };
  }
}

export default ClientAdapter;
