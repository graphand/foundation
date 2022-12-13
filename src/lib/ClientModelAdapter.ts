import { DataModel, Model, ModelAdapter, ModelList } from "@graphand/core";
import Client from "./Client";
import { BehaviorSubject } from "rxjs";

class ClientModelAdapter<
  T extends typeof Model = typeof Model
> extends ModelAdapter<T> {
  static __client: Client;
  private __instancesMap: Map<string, InstanceType<T>>;

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
      i = this.instancesMap.get(String(payload._id));
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
      this.instancesMap.set(String(payload._id), i);
    }

    return i;
  }

  async count(query) {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    return await this.client.fetch(`${this.model.slug}/count`, {
      method: "POST",
      body: JSON.stringify(query),
    });
  }

  async get(query) {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    if (typeof query === "string") {
      const res = await this.client.fetch(`${this.model.slug}/${query}`, {
        method: "GET",
      });

      return this.mapOrNew(res);
    } else {
      query.pageSize = 1;

      const list = await this.getList(query);

      if (!list) {
        return null;
      }

      return list[0] as InstanceType<T>;
    }
  }

  async getList(query) {
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
  }

  async createOne(payload) {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    const res = await this.client.fetch(this.model.slug, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return this.mapOrNew(res);
  }

  async createMultiple(payload) {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    const res = await this.client.fetch(this.model.slug, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return res.map((r) => this.mapOrNew(r));
  }

  async updateOne(query, update) {
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

      const list = await this.updateMultiple(query, update);

      if (!list) {
        return null;
      }

      return list[0] as InstanceType<T>;
    }
  }

  async updateMultiple(query, update) {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    const res = await this.client.fetch(this.model.slug, {
      method: "PATCH",
      body: JSON.stringify({ ...query, update }),
    });

    return res.map((r) => this.mapOrNew(r) as InstanceType<T>);
  }

  async deleteOne(query): Promise<boolean> {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    if (typeof query === "string") {
      const res = await this.client.fetch(`${this.model.slug}/${query}`, {
        method: "DELETE",
      });

      return res === 1;
    } else {
      query.pageSize = 1;

      const res = await this.deleteMultiple(query);

      return res === 1;
    }
  }

  async deleteMultiple(query): Promise<number> {
    if (!this.client) {
      throw new Error("MODEL_NO_CLIENT");
    }

    const res = await this.client.fetch(this.model.slug, {
      method: "DELETE",
      body: JSON.stringify(query),
    });

    return res;
  }

  async loadSchema() {
    if (!this.model.extendable) {
      return null;
    }

    const dataModel = await DataModel.withAdapter(this.toConstructor()).get({
      filter: { slug: this.model.slug },
    });

    return dataModel?.schema;
  }
}

export default ClientModelAdapter;
