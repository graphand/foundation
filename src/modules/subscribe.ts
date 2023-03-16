import { Model, ModelList } from "@graphand/core";
import { ModelUpdaterEvent } from "../types";
import ClientAdapter from "../lib/ClientAdapter";

Model.subscribe = function (cb: (event: ModelUpdaterEvent) => void) {
  const adapter = this.__adapter as ClientAdapter;
  return adapter.updaterSubject.subscribe(cb);
};

Model.prototype.subscribe = function (cb: () => void) {
  const _subscriber = (event: ModelUpdaterEvent) => {
    if (event.ids.includes(this._id)) {
      cb();
    }
  };

  const adapter = this.model.__adapter as ClientAdapter;
  return adapter.updaterSubject.subscribe(_subscriber);
};

ModelList.prototype.subscribe = function (cb: () => void) {
  const _subscriber = (event: ModelUpdaterEvent) => {
    if (event.operation === "create") {
      cb();
    } else if (event.operation === "delete") {
      for (let i = 0; i < this.length; i++) {
        if (event.ids.includes(this[i]._id)) {
          this.splice(i, 1);
          i--;
        }
      }
      cb();
    } else if (event.operation === "update") {
      const listIds = this.getIds();
      const listUpdated = event.ids.some((i: string) => listIds.includes(i));
      if (listUpdated) {
        cb();
      }
    }
  };

  const adapter = this.model.__adapter as ClientAdapter;
  return adapter.updaterSubject.subscribe(_subscriber);
};
