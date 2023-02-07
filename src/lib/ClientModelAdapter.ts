import {
  Adapter,
  AdapterFetcher,
  controllersMap,
  Model,
  ModelList,
} from "@graphand/core";
import Client from "./Client";
import Subject from "./Subject";
import { executeController } from "../utils";

class ClientModelAdapter extends Adapter {
  static __client: Client;
  __instancesMap: Map<string, Model>;
  __updaterSubject: Subject<Array<object | string>>;

  runValidators = false;

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
        const res = await executeController(
          this.client,
          controllersMap.modelRead,
          {
            path: {
              id: query,
              model: this.model.slug,
            },
            body: query,
          }
        );

        if (!res) {
          return null;
        }

        return this.mapOrNew(res);
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.getList([query], ctx);

        if (!list) {
          throw new Error();
        }

        return list[0] || null;
      }
    },
    getList: async ([query]) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
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

      const documents = res.rows.map((r) => this.mapOrNew(r));
      const count = res.count;

      return new ModelList(this.model, documents, count);
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

      this.__updaterSubject.next([res]);

      return this.mapOrNew(res);
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

      this.__updaterSubject.next(res);

      return res.map((r) => this.mapOrNew(r));
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

        this.__updaterSubject.next([res]);

        return this.mapOrNew(res);
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple([query, update], ctx);

        if (!list) {
          throw new Error();
        }

        this.__updaterSubject.next(list);

        return list[0] || null;
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

      this.__updaterSubject.next(res);

      return res.map((r) => this.mapOrNew(r));
    },
    deleteOne: async ([query], ctx) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      if (typeof query === "string") {
        const res = await executeController(
          this.client,
          controllersMap.modelDelete,
          {
            path: {
              id: query,
              model: this.model.slug,
            },
          }
        );

        const deleted = res === 1;
        if (deleted) {
          this.instancesMap.delete(query);
        }

        this.__updaterSubject.next([query]);

        return deleted;
      } else {
        query.pageSize = 1;

        const res = await this.fetcher.deleteMultiple([query], ctx);

        res.forEach(this.instancesMap.delete);

        this.__updaterSubject.next(res);

        return res?.length === 1;
      }
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

      res.forEach(this.instancesMap.delete);

      this.__updaterSubject.next(res);

      return res;
    },
    getModelDefinition: async () => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

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

      const datamodel = res.rows?.[0];

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

  constructor(model) {
    super(model);

    this.__instancesMap = new Map();
    this.__updaterSubject = new Subject();
  }

  static get client() {
    return this.__client;
  }

  get client() {
    const { constructor } = Object.getPrototypeOf(this);
    return constructor.__client;
  }

  get instancesMap() {
    return this.__instancesMap;
  }

  private mapOrNew(payload: any) {
    let i;

    if (payload._id) {
      i = this.instancesMap.get(payload._id);
    }

    if (i) {
      if (
        (payload.updatedAt && !i.updatedAt) ||
        new Date(payload.updatedAt) > new Date(i.updatedAt)
      ) {
        i.setDoc(payload);
      }
    } else {
      i = new this.model(payload);
      this.instancesMap.set(payload._id, i);
    }

    return i;
  }
}

export default ClientModelAdapter;
