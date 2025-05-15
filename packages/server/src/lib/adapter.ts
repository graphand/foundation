import { Adapter, Model, ModelList, TransactionCtx } from "@graphand/core";
import { RequestHelper } from "./request-helper.js";
import { ModuleDatabase } from "@graphand/server-module-database";
import { DataDoc } from "./models/DataDoc.js";

export class ServerAdapter<T extends typeof Model = typeof Model> extends Adapter<T> {
  static request: RequestHelper;
  static runWriteValidators = true;

  getRequestHelper() {
    const constructor = this.constructor as typeof ServerAdapter;
    return constructor.request;
  }

  fetcher: Adapter<T>["fetcher"] = {
    count: async (_, ctx: TransactionCtx) => {
      const request = this.getRequestHelper();
      const service = request.server.get(ModuleDatabase).service;

      if (this.model.configuration.single) {
        const DocModel = request.model(DataDoc);
        DocModel.modelSlug = this.model.slug;
        return await service.count({
          ...ctx,
          model: DocModel,
          mergeFilter: { _slug: this.model.slug },
        });
      }

      return await service.count({ ...ctx, model: this.model });
    },
    get: async (_, ctx: TransactionCtx) => {
      const request = this.getRequestHelper();
      const service = request.server.get(ModuleDatabase).service;

      await this.model.initialize();

      if (this.model.configuration.single) {
        const DocModel = request.model(DataDoc);
        DocModel.modelSlug = this.model.configuration.slug;
        const document = await service.findOne({
          ...ctx,
          model: DocModel,
          mergeFilter: { _slug: this.model.configuration.slug },
        });

        if (!document) {
          return null;
        }

        return this.model.hydrate(document as any);
      }

      return await service.findOne({
        ...ctx,
        model: this.model,
      });
    },
    getList: async ([query], ctx: TransactionCtx) => {
      if (this.model.configuration.single) {
        return;
      }

      const service = this.getRequestHelper().server.get(ModuleDatabase).service;

      const res = await service.findAndCount({
        ...ctx,
        model: this.model,
      });

      if (!res) {
        return null;
      }

      const { rows, count } = res;

      if (query?.ids?.length) {
        const ids = query.ids.map(id => String(id));
        rows.sort((a, b) => {
          return ids.indexOf(a._id) - ids.indexOf(b._id);
        });
      }

      return new ModelList(this.model, rows, query, count);
    },
    createOne: async (_, ctx: TransactionCtx) => {
      if (this.model.configuration.single) {
        throw new Error("Single model cannot be created");
      }

      const service = this.getRequestHelper().server.get(ModuleDatabase).service;

      return await service.insertOne({
        ...ctx,
        model: this.model,
      });
    },
    createMultiple: async (_, ctx: TransactionCtx) => {
      if (this.model.configuration.single) {
        throw new Error("Single model cannot be created");
      }

      const service = this.getRequestHelper().server.get(ModuleDatabase).service;

      return await service.insertMany({
        ...ctx,
        model: this.model,
      });
    },
  };
}
