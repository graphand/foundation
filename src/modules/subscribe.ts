import { Model, ModelList } from "@graphand/core";
import { ModelUpdaterEvent } from "../types";
import ClientAdapter from "../lib/ClientAdapter";

Model.subscribe = function (cb: (event: ModelUpdaterEvent) => void) {
  const adapter = this.getAdapter() as ClientAdapter;
  return adapter.updaterSubject.subscribe(cb);
};

Model.prototype.subscribe = function (cb: (event: ModelUpdaterEvent) => void) {
  const _subscriber = (event: ModelUpdaterEvent) => {
    if (event.ids.includes(this._id)) {
      cb(event);
    }
  };

  const adapter = this.model.getAdapter() as ClientAdapter;
  return adapter.updaterSubject.subscribe(_subscriber);
};

ModelList.prototype.subscribe = function (
  cb: (event: ModelUpdaterEvent) => void,
  cbLoading?: (loading: boolean) => void
) {
  let prevLastUpdatedAt;
  let prevLastUpdatedId;

  // This function aims to reload the current list and then trigger the callback if the list has changed
  const _handleEvent = async (event: ModelUpdaterEvent) => {
    cbLoading?.(true);
    await this.reload();
    cbLoading?.(false);

    const lastUpdated = this.lastUpdated;
    const lastUpdatedAt = (
      lastUpdated?._updatedAt ?? lastUpdated?._createdAt
    )?.getTime();

    // if the list has not changed, do not trigger the callback
    if (
      lastUpdated._id === prevLastUpdatedId &&
      prevLastUpdatedAt === lastUpdatedAt
    ) {
      return;
    }

    prevLastUpdatedId = lastUpdated._id;
    prevLastUpdatedAt = lastUpdatedAt;
    cb(event);
  };

  const _subscriber = (event: ModelUpdaterEvent) => {
    let _update = false;
    let _forceTrigger = false;

    if (["create", "update"].includes(event.operation)) {
      _update = true;
    } else if (event.operation === "delete") {
      for (let i = 0; i < this.length; i++) {
        if (event.ids.includes(this[i]._id)) {
          _forceTrigger = true;
          this.splice(i, 1);
          i--;
        }
      }

      _update = true;
    }

    if (_update) {
      _handleEvent(event);
    }
  };

  const adapter = this.model.getAdapter() as ClientAdapter;
  return adapter.updaterSubject.subscribe(_subscriber);
};
