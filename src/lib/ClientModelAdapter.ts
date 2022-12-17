import {
  Model,
  ModelAdapter,
  ModelAdapterFetcher,
  ModelList,
} from "@graphand/core";
import Client from "./Client";

class ClientModelAdapter<
  T extends typeof Model = typeof Model
> extends ModelAdapter<T> {
  static __client: Client;
  private __instancesMap: Map<string, InstanceType<T>>;

  fetcher: ModelAdapterFetcher<T> = {
    count: async (query) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      return await this.client.fetch(`${this.model.slug}/count`, {
        method: "POST",
        body: JSON.stringify(query),
      });
    },
    get: async (query = {}) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      if (typeof query === "string") {
        const res = await this.client.fetch(`${this.model.slug}/${query}`, {
          method: "GET",
        });

        if (!res) {
          return null;
        }

        return this.mapOrNew(res);
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.getList(query);

        if (!list) {
          throw new Error();
        }

        return (list[0] as InstanceType<T>) || null;
      }
    },
    getList: async (query) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch(`${this.model.slug}/query`, {
        method: "POST",
        body: JSON.stringify(query),
      });

      const documents = res.rows.map((r) => this.mapOrNew(r));
      const count = res.count;

      return new ModelList<InstanceType<T>>(this.model, documents, count);
    },
    createOne: async (payload) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch(this.model.slug, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return this.mapOrNew(res);
    },
    createMultiple: async (payload) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch(this.model.slug, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return res.map((r) => this.mapOrNew(r));
    },
    updateOne: async (query, update) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      if (typeof query === "string") {
        const res = await this.client.fetch(`${this.model.slug}/${query}`, {
          method: "PATCH",
          body: JSON.stringify({ update }),
        });

        return this.mapOrNew(res);
      } else {
        query.pageSize = 1;

        const list = await this.fetcher.updateMultiple(query, update);

        if (!list) {
          throw new Error();
        }

        return list[0] as InstanceType<T>;
      }
    },
    updateMultiple: async (query, update) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch(this.model.slug, {
        method: "PATCH",
        body: JSON.stringify({ ...query, update }),
      });

      return res.map((r) => this.mapOrNew(r) as InstanceType<T>);
    },
    deleteOne: async (query) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      if (typeof query === "string") {
        const res = await this.client.fetch(`${this.model.slug}/${query}`, {
          method: "DELETE",
        });

        const deleted = res === 1;
        if (deleted) {
          this.instancesMap.delete(query);
        }

        return deleted;
      } else {
        query.pageSize = 1;

        const res = await this.fetcher.deleteMultiple(query);

        res.forEach(this.instancesMap.delete);

        return res?.length === 1;
      }
    },
    deleteMultiple: async (query) => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch(this.model.slug, {
        method: "DELETE",
        body: JSON.stringify(query),
      });

      res.forEach((_id) => this.instancesMap.delete(_id));

      return res;
    },
    getFields: async () => {
      if (!this.client) {
        throw new Error("MODEL_NO_CLIENT");
      }

      const res = await this.client.fetch("datamodels/query", {
        method: "POST",
        body: JSON.stringify({
          filter: { slug: this.model.slug },
          pageSize: 1,
        }),
      });

      return res.rows?.[0]?.fields || [];
    },
  };

  constructor() {
    super();

    this.__instancesMap = new Map();
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

  private mapOrNew(payload: any): InstanceType<T> {
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
