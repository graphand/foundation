import { InferModel, Model, ModelInstance, ModelJSON, ModelList, PromiseModel, PromiseModelList } from "@graphand/core";
import { getCachedModel, getCachedModelList, getCachedPartialModelList } from "./lib/utils.js";
import type { ClientAdapter } from "./lib/ClientAdapter.js";
import type { InferModelFromList, ModelUpdaterEvent, SubjectObserver } from "./types.js";
import type { Client } from "./lib/Client.js";

Model.subscribe = function <T extends typeof Model>(
  this: T,
  observer: SubjectObserver<ModelUpdaterEvent>,
): ReturnType<ClientAdapter<T>["subscribe"]> {
  const adapter = this.getAdapter() as ClientAdapter<T>;
  return adapter.subscribe(observer);
};

Model.prototype.subscribe = function <T extends ModelInstance>(
  this: T,
  observer: (_previousData: ReturnType<T["getData"]>, _event: ModelUpdaterEvent) => void,
): ReturnType<ClientAdapter<InferModel<T>>["subscribe"]> {
  let previousData = this.getData();

  return this.model().subscribe(event => {
    if (this._id && event.ids.includes(this._id) && ["update", "delete"].includes(event.operation)) {
      observer.call(this, previousData, event);
      previousData = this.getData();
    }
  });
};

Model.hydrateAndCache = function <T extends typeof Model>(this: T, json?: ModelJSON<T>): ModelInstance<T> {
  const adapter = this.getAdapter() as ClientAdapter<T>;
  return adapter.processAndCacheInstance(json) as ModelInstance<T>;
};

ModelList.prototype.getKey = function <T extends ModelList<typeof Model>>(this: T): string {
  const map = new Map<string, number>();

  for (const i of this) {
    const _age = i.__getAge();
    const _id = i._id as string;
    map.set(_id, Math.max(_age, map.get(_id) || 0));
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(p => p.join(":"))
    .join(",");
};

ModelList.prototype.getMostRecent = function <T extends ModelList<typeof Model>>(this: T) {
  return this.reduce(
    (mostRecent, current) => {
      const currentAge = current.__getAge();
      return !mostRecent || currentAge > mostRecent.__getAge() ? current : mostRecent;
    },
    undefined as ModelInstance | undefined,
  );
};

ModelList.prototype.subscribe = function <T extends ModelList<typeof Model>>(
  this: T,
  observer: SubjectObserver<ModelUpdaterEvent>,
  opts?: {
    onLoadingChange?: (_loading: boolean) => void;
    onError?: (_error: Error) => void;
    noReload?: boolean; // Do not reload the list when an item is updated or deleted
    autoRemove?: boolean; // Automatically remove the item from the list when it is deleted (before the reload)
    reload?: () => Promise<void>; // Custom reload function (by default, it calls list.reload())
  },
): ReturnType<ClientAdapter<InferModelFromList<T>>["subscribe"]> {
  const { onLoadingChange, onError, noReload, autoRemove } = opts ?? {};
  let { reload } = opts ?? {};
  let state = this.getCurrentState();

  const handleUpdate = async (event: ModelUpdaterEvent) => {
    onLoadingChange?.(true);

    try {
      if (!noReload) {
        reload ??= async () => this.reload();
        await reload();
      } else if (event.operation === "delete" && autoRemove) {
        this.remove(event.ids);
      }

      const newState = this.getCurrentState();
      if (this.hasStateChanged(state, newState)) {
        state = newState;
        observer(event);
      }
    } catch (e) {
      onError?.(e as Error);
    } finally {
      onLoadingChange?.(false);
    }
  };

  const shouldUpdate = (event: ModelUpdaterEvent) => {
    return (
      ["create", "update"].includes(event.operation) ||
      (event.operation === "delete" && this.some(item => event.ids.includes(String(item._id))))
    );
  };

  return this.model.subscribe(event => {
    if (shouldUpdate(event)) {
      handleUpdate(event);
    }
  });
};

Model.prototype.__getAge = function <T extends ModelInstance>(this: T): number {
  return Math.max(this.__fetchedAt?.getTime() ?? 0, this._updatedAt?.getTime() ?? 0, this._createdAt?.getTime() ?? 0);
};

Model.clearCache = function <T extends typeof Model>(this: T): T {
  const adapter = this.getAdapter() as ClientAdapter<T>;
  adapter.clearInstances();
  return this;
};

Model.getClient = function <T extends typeof Model>(this: T): Client {
  const adapter = this.getAdapter() as ClientAdapter<T>;
  return adapter.client;
};

// Helper methods for ModelList
ModelList.prototype.getCurrentState = function <T extends ModelList<typeof Model>>(this: T) {
  const mostRecent = this.getMostRecent();
  return {
    lastId: mostRecent?._id,
    length: this.length,
    lastAge: mostRecent?.__getAge(),
    key: this.getKey(),
  };
};

ModelList.prototype.hasStateChanged = function <T extends ModelList<typeof Model>>(
  this: T,
  oldState: ReturnType<T["getCurrentState"]>,
  newState: ReturnType<T["getCurrentState"]>,
) {
  return (
    oldState.lastId !== newState.lastId ||
    oldState.length !== newState.length ||
    oldState.lastAge !== newState.lastAge ||
    oldState.key !== newState.key
  );
};

/**
 * Allow to access the cached instance of a model from a PromiseModel
 * Add ability to get a cached instance in a synchronous way
 * @example
 * const promise = model.get("id"); // promise is a PromiseModel
 * const instance = model.get("id").cached; // instance is a Model instance (or null if not found in cache)
 */
Object.defineProperty(PromiseModel.prototype, "cached", {
  get() {
    return getCachedModel(this);
  },
});

/**
 * Allow to access the cached instances of a model from a PromiseModelList
 * Add ability to get a cached instances in a synchronous way
 * @example
 * const promise = model.getList(); // promise is a PromiseModelList
 * const instances = model.getList().cached; // instances is a ModelList (or null if not found in cache)
 */
Object.defineProperty(PromiseModelList.prototype, "cached", {
  get() {
    return getCachedModelList(this);
  },
});

Object.defineProperty(PromiseModelList.prototype, "cachedPartial", {
  get() {
    return getCachedPartialModelList(this);
  },
});
