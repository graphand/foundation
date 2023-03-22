import {
  Adapter,
  AdapterFetcher,
  controllersMap,
  Model,
  ModelList,
  ModelCrudEvent,
  ModelCreateEvent,
  ModelDeleteEvent,
  ModelUpdateEvent,
} from "@graphand/core";
import Client from "./Client";
import Subject from "./Subject";
import {
  canUseIds,
  executeController,
  getPopulatedFromQuery,
  parsePopulated,
} from "./utils";
import { Socket } from "socket.io-client";
import { ModelUpdaterEvent } from "../types";

class ClientAdapter extends Adapter {
  static __client: Client;
  __instancesMap: Map<string, Model>;
  __updaterSubject: Subject<ModelUpdaterEvent>;
  __eventSubject: Subject<ModelCrudEvent>;

  runValidators = false;

  constructor(data) {
    super(data);

    this.__eventSubject = new Subject();

    this.__eventSubject.subscribe((event) => {
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
        throw new Error("MODEL_NO_CLIENT");
      }

      return await executeController(this.client, controllersMap.modelCount, {
        path: {
          model: this.model.slug,
        },
        body: query,
      });
    },
    get: async ([query], ctx) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      if (typeof query === "string") {
        if (this.instancesMap.has(query)) {
          return this.instancesMap.get(query);
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

        parsePopulated(this.model, [res], getPopulatedFromQuery(query));

        const { mapped, updated } = this.mapOrNew(res);

        this.updaterSubject.next({
          ids: [mapped._id],
          operation: "fetch",
        });

        if (updated) {
          this.updaterSubject.next({
            ids: [mapped._id],
            operation: "localUpdate",
          });
        }

        return mapped;
      } else {
        if (canUseIds(query)) {
          return this.fetcher.get([query.ids[0]], ctx);
        }

        query.pageSize = 1;

        const list = await this.fetcher.getList([query], ctx);

        if (!list) {
          throw new Error();
        }

        if (!list[0]) {
          return null;
        }

        return list[0];

        // parsePopulated(this.model, list, getPopulatedFromQuery(query));
        //
        // const { mapped, updated } = this.mapOrNew(list[0]);
        //
        // this.updaterSubject.next({
        //   ids: [mapped._id],
        //   operation: "fetch",
        // });
        //
        // if (updated) {
        //   this.updaterSubject.next({
        //     ids: [mapped._id],
        //     operation: "localUpdate",
        //   });
        // }
        //
        // return mapped;
      }
    },
    getList: async ([query], ctx) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const _canUseIds = canUseIds(query) as Array<string>;
      let _fromIdsList: Array<Model> = [];

      if (_canUseIds) {
        const existingIds = query.ids.filter((id) => this.instancesMap.has(id));
        _fromIdsList = existingIds.map((id) => this.instancesMap.get(id));

        if (_fromIdsList.length === query.ids.length) {
          return new ModelList(this.model, _fromIdsList, _fromIdsList.length);
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

      parsePopulated(this.model, res.rows, getPopulatedFromQuery(query));

      const mappedList = res.rows.map((r) => this.mapOrNew(r));
      const mappedRes = mappedList.map((r) => r.mapped);
      const updated = mappedList
        .filter((r) => r.updated)
        .map((r) => r.mapped._id);

      this.updaterSubject.next({
        ids: mappedRes.map((r) => r._id),
        operation: "fetch",
      });

      if (updated?.length) {
        this.updaterSubject.next({
          ids: updated,
          operation: "localUpdate",
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

      return new ModelList(this.model, list, count);
    },
    createOne: async ([payload]) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
        ids: [res._id],
        data: [res],
      } as ModelCreateEvent);

      return this.mapOrNew(res).mapped;
    },
    createMultiple: async ([payload]) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
      } as ModelCreateEvent);

      return res.map((r) => this.mapOrNew(r).mapped);
    },
    updateOne: async ([query, update], ctx) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
        } as ModelUpdateEvent);

        return this.mapOrNew(res).mapped;
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple([query, update], ctx);

        if (!list) {
          throw new Error();
        }

        this.__eventSubject.next({
          operation: "update",
          model: this.model.slug,
          ids: list.map((l) => l._id),
          data: list,
        } as ModelUpdateEvent);

        return this.mapOrNew(list[0]).mapped;
      }
    },
    updateMultiple: async ([query, update]) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
      } as ModelUpdateEvent);

      return res.map((r) => this.mapOrNew(r).mapped);
    },
    deleteOne: async ([query], ctx) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
      } as ModelDeleteEvent);

      return Boolean(res?.length);
    },
    deleteMultiple: async ([query]) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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
      } as ModelDeleteEvent);

      return res;
    },
    getModelDefinition: async () => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      let datamodel;

      if ("__datamodel" in this.model) {
        datamodel = this.model.__datamodel;
      }

      if (!datamodel) {
        const res = await executeController(
          this.client,
          controllersMap.modelQuery,
          {
            path: {
              model: "datamodels",
            },
            body: {
              filter: { slug: this.model.slug },
              pageSize: 1,
            },
          }
        );

        datamodel = res.rows?.[0];
      }

      if (!datamodel) {
        return {
          fields: {},
          validators: [],
        };
      }

      return {
        fields: datamodel.fields,
        validators: datamodel.validators,
        configKey: datamodel.configKey,
      };
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

  mapOrNew(payload: any) {
    let mapped;
    let updated = false;

    if (payload._id) {
      mapped = this.instancesMap.get(payload._id);
    }

    if (mapped) {
      if (
        (payload._updatedAt && !mapped._updatedAt) ||
        new Date(payload._updatedAt) > new Date(mapped._updatedAt)
      ) {
        updated = true;
        mapped.setDoc(payload);
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
