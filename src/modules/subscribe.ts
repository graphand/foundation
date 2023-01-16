import ClientModelAdapter from "../lib/ClientModelAdapter";
import { Model } from "@graphand/core";

Model.subscribe = function (callback) {
  const adapter = this.model.__adapter as ClientModelAdapter;
  return adapter.__updaterSubject.subscribe((payload) => {
    return callback.call(this, payload);
  });
};

Model.prototype.subscribe = function (callback) {
  const adapter = this.model.__adapter as ClientModelAdapter;
  const unsubscribe = adapter.__updaterSubject.subscribe((payload) => {
    const _previous = this.__doc;
    const deleted = payload.find(
      (p: any) => typeof p === "string" && p === this._id
    );
    if (deleted) {
      unsubscribe();
      return setTimeout(() => callback.call(this, _previous));
    }

    const updated = payload.find(
      (p: any) => typeof p === "object" && p._id === this._id
    );
    if (updated) {
      return setTimeout(() => callback.call(this, _previous));
    }

    return;
  });

  return unsubscribe;
};
