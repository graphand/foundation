import {
  Field,
  JSONQuery,
  Model,
  ModelInstance,
  ModelList,
  PromiseModel,
  PromiseModelList,
  ValidationError,
  ValidationFieldError,
  ValidationValidatorError,
  Validator,
} from "@graphand/core";
import { ModuleConstructor, ModuleWithConfig } from "@/types";
import { ClientError } from "./ClientError";
import { FetchError } from "./FetchError";
import { ClientAdapter } from "./ClientAdapter";

export const canUseIds = (query: JSONQuery): boolean => {
  if (
    !query.ids ||
    !Array.isArray(query.ids) ||
    !query.ids?.length ||
    query.filter ||
    query.pageSize ||
    query.limit ||
    query.skip ||
    query.sort ||
    query.populate
  ) {
    return false;
  }

  return true;
};

export const decodeClientModule = <T extends ModuleConstructor>(
  module: ModuleWithConfig<T>,
): {
  moduleClass: T;
  conf: ModuleWithConfig<T>[1];
} => {
  let moduleClass: T | undefined;
  let conf: ModuleWithConfig<T>[1];

  if (Array.isArray(module)) {
    moduleClass = module[0];
    conf = module[1];
  }

  if (!moduleClass) {
    throw new Error("Module class not found");
  }

  return { moduleClass, conf: conf || {} };
};

export const parseErrorFromJSON = (json: any, res?: Response) => {
  if (json?.type === "ValidationError") {
    const fields = json.reason?.fields?.map((f: any) => {
      const field = new Field(
        {
          type: f.field.type,
          options: f.field.options,
        },
        f.field.path,
      );
      return new ValidationFieldError({
        slug: f.slug,
        field,
      });
    });
    const validators = json.reason?.validators?.map((v: any) => {
      const validator = new Validator(
        {
          type: v.validator.type,
          options: v.validator.options,
        },
        v.validator.path,
      );

      return new ValidationValidatorError({
        validator,
        value: v.value,
      });
    });
    throw new ValidationError({
      fields,
      validators,
    });
  }

  if (res) {
    throw new FetchError({ ...json, res });
  }

  throw new ClientError(json);
};

export const getCachedModel = (promise: PromiseModel<typeof Model>) => {
  const adapter = promise.model.getAdapter() as ClientAdapter;

  if (promise.model.isSingle()) {
    if (adapter.store.size) {
      return adapter.store.values().next().value;
    }

    return null;
  }

  const _query = promise.query;
  if (typeof _query === "string") {
    if (adapter.store.has(_query)) {
      return adapter.store.get(_query);
    }

    return null;
  }

  return null;
};

export const getCachedModelList = (promise: PromiseModelList<typeof Model>) => {
  const adapter = promise.model.getAdapter() as ClientAdapter;

  const _query = promise.query;
  if (canUseIds(_query)) {
    const ids = promise.getIds();
    const cachedInstances = ids.map(id => adapter.store.get(id)).filter(Boolean) as ModelInstance[];

    if (cachedInstances.length === ids.length) {
      return new ModelList(promise.model, cachedInstances, _query);
    }
  }

  return null;
};

export const getCachedPartialModelList = (promise: PromiseModelList<typeof Model>) => {
  const adapter = promise.model.getAdapter() as ClientAdapter;

  const _query = promise.query;
  if (canUseIds(_query)) {
    const ids = promise.getIds();
    const cachedInstances = ids.map(id => adapter.store.get(id)).filter(Boolean) as ModelInstance[];

    return new ModelList(promise.model, cachedInstances, _query);
  }

  return null;
};
