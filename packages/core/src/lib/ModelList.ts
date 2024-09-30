import { JSONQuery, ModelInstance } from "@/types/index.ts";
import { Model } from "@/lib/Model.ts";

/**
 * ModelList is a class that extends the native Array class.
 * It is used to return a list of instances.
 * It could be used as an array (list.map(), list.filter(), etc.). and also exposes some useful properties and methods.
 */
export class ModelList<T extends typeof Model> extends Array<ModelInstance<T>> {
  #model: T; // Model class
  #query: JSONQuery; // Query used to fetch the list (returned by the adapter)
  #count: number; // Total count of the list (returned by the adapter)
  #reloadPromise: Promise<void> | undefined; // Promise to wait for the reload to finish

  constructor(model: T, list: Array<ModelInstance<T>> = [], query?: JSONQuery, count?: number) {
    super(...list);

    this.#model = model;
    this.#query = Object.freeze(query) as JSONQuery;
    this.#count = count as number;
  }

  /**
   * Returns the model class.
   */
  get model() {
    return this.#model;
  }

  /**
   * Returns the query used to fetch the list (JSONQuery), or the current list ids if no query is provided.
   */
  get query() {
    return this.#query || { ids: this.getIds() };
  }

  /**
   * Returns the total count of the list.
   * If the count is not available, it returns the length of the list.
   */
  get count() {
    return this.#count || this.length || 0;
  }

  /**
   * Returns if the list is loading.
   * When created, the list is not loading. The loading state is set to true when the reload() method is called.
   */
  get loading() {
    return Boolean(this.#reloadPromise);
  }

  /**
   * Returns the last updated item of the list.
   */
  get lastUpdated(): ModelInstance<T> | undefined {
    let _maxUpdated: ModelInstance<T> | undefined;
    let _maxUpdatedTime: number | undefined;

    for (const i of this) {
      const _updatedTime = i._updatedAt?.getTime() ?? i._createdAt?.getTime();

      if (_maxUpdatedTime === undefined || (_updatedTime !== undefined && _updatedTime > _maxUpdatedTime)) {
        _maxUpdated = i;
        _maxUpdatedTime = _updatedTime;
      }
    }

    return _maxUpdated;
  }

  /**
   * Reload the list from the given model and query.
   * Returns a promise that resolves when the list is reloaded.
   */
  async reload() {
    this.#reloadPromise ??= new Promise<void>(async (resolve, reject) => {
      try {
        const { model, query } = this;
        const list = await model.getList(query);
        this.splice(0, this.length, ...list);
        this.#count = list.count;
        resolve();
      } catch (e) {
        reject(e);
      }
    }).finally(() => {
      this.#reloadPromise = undefined;
    });

    return this.#reloadPromise;
  }

  /**
   * Returns a native array with the items of the list.
   * This method is useful to break the reference to the list (list.filter() will return an instance of ModelList but list.toArray().filter() will return an array).
   */
  toArray(): Array<ModelInstance<T>> {
    const arr = [];
    for (const item of this) {
      arr.push(item);
    }
    return arr;
  }

  /**
   * Returns an array of ids of the items of the list.
   */
  getIds(): Array<string> {
    const ids: Array<string> = [];
    for (const item of this) {
      ids.push(item._id as string);
    }
    return ids;
  }

  /**
   * Returns a JSON representation of the list.
   */
  toJSON() {
    return {
      rows: this.toArray().map(r => r.toJSON()),
      count: this.#count,
    };
  }

  /**
   * Removes the items with the given ids from the list.
   * @param ids - An array of ids to remove from the list.
   * @returns The current list.
   */
  remove(ids: Array<string> = []) {
    this.splice(0, this.length, ...this.filter(i => !ids.includes(i._id as string)));
    return this;
  }
}
