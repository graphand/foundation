import { InferModel, Model, ModelInstance, ModelList } from "@graphand/core";
import { ClientAdapter } from "./lib/ClientAdapter";
import { InferModelFromList, ModelUpdaterEvent, SubjectObserver } from "./types";
import { Client } from "./lib/Client";

Model.subscribe = function <T extends typeof Model>(
  this: T,
  observer: SubjectObserver<ModelUpdaterEvent>,
): ReturnType<ClientAdapter<T>["subscribe"]> {
  return (this.getAdapter() as ClientAdapter<T>).subscribe(observer);
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

ModelList.prototype.getKey = function <T extends ModelList<typeof Model>>(this: T): string {
  const map = new Map<string, number>();

  for (const i of this) {
    const _age = i.__getAge();
    map.set(i._id, Math.max(_age, map.get(i._id) || 0));
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
    noReload?: boolean;
  },
): ReturnType<ClientAdapter<InferModelFromList<T>>["subscribe"]> {
  const { onLoadingChange, onError, noReload } = opts ?? {};
  let state = this.getCurrentState();

  const handleUpdate = async (event: ModelUpdaterEvent) => {
    onLoadingChange?.(true);

    try {
      if (!noReload) {
        await this.reload();
      } else if (event.operation === "delete") {
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
  (this.getAdapter() as ClientAdapter<T>).clearInstances();
  return this;
};

Model.getClient = function <T extends typeof Model>(this: T): Client {
  return (this.getAdapter() as ClientAdapter<T>).client;
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
