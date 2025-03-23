import {
  JSONQuery,
  Model,
  ModelInstance,
  ModelList,
  PromiseModel,
  PromiseModelList,
  ValidationError,
  GDXDatamodels,
} from "@graphand/core";
import { ModuleConstructor, ModuleWithConfig, TransformFunction, TraverseOptions } from "@/types.js";
import { ClientError } from "./ClientError.js";
import { FetchError } from "./FetchError.js";
import { ClientAdapter } from "./ClientAdapter.js";
import { ClientOptions } from "@/types.js";

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
    return ValidationError.fromJSON(json);
  }

  if (res) {
    throw new FetchError({ ...json, res });
  }

  throw new ClientError(json);
};

export const getCachedModel = (promise: PromiseModel<typeof Model>) => {
  const adapter = promise.model.getAdapter() as ClientAdapter;

  if (promise.model.configuration.single) {
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

export const traverseObject = (
  obj: any,
  options: TraverseOptions | TransformFunction,
  visited: WeakSet<object> = new WeakSet(),
): any => {
  const opts: TraverseOptions = typeof options === "function" ? { transform: options } : options;
  const { preTransformObject, preTransformArray } = opts;
  const transform = opts.transform ?? (v => v);

  // Handle null and non-objects
  if (obj === null || typeof obj !== "object") {
    return transform(obj);
  }

  // Handle circular references
  if (visited.has(obj)) {
    return obj;
  }

  // Add current object to visited set
  visited.add(obj);

  // Pre-transform arrays if handler provided
  if (Array.isArray(obj)) {
    const preTransformed = preTransformArray ? preTransformArray(obj) : null;
    if (preTransformed !== null) {
      obj = preTransformed;
    }
    return obj.map((item: any, _index: number) => traverseObject(item, opts, visited));
  }

  // Pre-transform objects if handler provided
  const preTransformed = preTransformObject ? preTransformObject(obj) : null;
  if (preTransformed !== null) {
    obj = preTransformed;
  }

  if (typeof obj !== "object") {
    return transform(obj, undefined);
  }

  // Handle objects
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = traverseObject(value, opts, visited);
  }

  return transform(result, undefined);
};

export const defineClientOptions = <const D extends GDXDatamodels>(options: ClientOptions<D>): ClientOptions<D> =>
  options;
