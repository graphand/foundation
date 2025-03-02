import { Adapter } from "@/lib/adapter.js";
import { AdapterFetcher, ModelData, ModelDefinition, ModelInstance } from "@/types/index.js";
import { ModelList } from "@/lib/model-list.js";
import { Model } from "@/lib/model.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { defineFieldsProperties, isObjectId } from "@/lib/utils.js";
import { Validator } from "@/lib/validator.js";
import { ObjectId } from "bson";
import { modelDecorator } from "@/lib/model-decorator.js";

const cache: Map<typeof Model, Set<ModelInstance<typeof Model>>> = new Map();

export const mockAdapter = ({
  name = "MockAdapter",
  fieldsMap = {},
  validatorsMap = {
    [ValidatorTypes.SAMPLE]: class ValidatorSample extends Validator<ValidatorTypes.SAMPLE> {
      validate = () => Promise.resolve(true);
    },
  },
  privateCache,
}: {
  name?: string;
  fieldsMap?: (typeof Adapter)["fieldsMap"];
  validatorsMap?: (typeof Adapter)["validatorsMap"];
  privateCache?: Set<ModelInstance<typeof Model>>;
} = {}) => {
  class MockAdapter<T extends typeof Model = typeof Model> extends Adapter<T> {
    static __name = name;
    static runWriteValidators = true;
    static fieldsMap = fieldsMap;
    static validatorsMap = validatorsMap;

    get thisCache(): Set<ModelInstance<T>> {
      if (privateCache) {
        return privateCache as Set<ModelInstance<T>>;
      }

      const cacheKey = this.model.getBaseClass();

      let cacheModel = cache.get(cacheKey) as Set<ModelInstance<T>> | undefined;
      if (!cacheModel) {
        cacheModel = new Set<ModelInstance<T>>(
          Array(5)
            .fill(null)
            .map(() => this.model.hydrate()),
        );

        cache.set(cacheKey, cacheModel as Set<ModelInstance<typeof Model>>);
      }

      return cacheModel;
    }

    fetcher: AdapterFetcher<T> = {
      count: () => Promise.resolve(this.thisCache.size),
      get: ([query]) => {
        if (!query) {
          return Promise.resolve(null);
        }

        const cache = Array.from(this.thisCache);

        if (typeof query === "string") {
          const keyField = this.model.getKeyField();

          if (keyField === "_id" || isObjectId(query)) {
            return Promise.resolve(cache.find(r => r._id === query) || null);
          }

          return Promise.resolve(cache.find(r => r.get(keyField) === query) || null);
        }

        let found = cache[0];

        if (query.filter) {
          const filterEntries = Object.entries(query.filter);
          found = cache.find(r => filterEntries.every(([key, value]) => r.get(key) === value));
        }

        return Promise.resolve(found || null);
      },
      getList: ([query]) => {
        if (query?.ids) {
          const arr = Array.from(this.thisCache);
          const list = query.ids.map(id => arr.find(r => r._id === id)).filter(Boolean) as Array<ModelInstance<T>>;
          return Promise.resolve(new ModelList(this.model, list));
        }

        return Promise.resolve(new ModelList(this.model, Array.from(this.thisCache)));
      },
      createOne: async ([payload]) => {
        payload._id ??= String(new ObjectId());
        const i = this.model.hydrate(payload as ModelData<T>);
        this.thisCache.add(i as ModelInstance<T>);
        return Promise.resolve(i);
      },
      createMultiple: ([payload]) => {
        const created = payload.map(p => {
          p._id ??= String(new ObjectId());
          return this.model.hydrate(p as ModelData<T>);
        });
        created.forEach(i => this.thisCache.add(i as ModelInstance<T>));
        return Promise.resolve(created);
      },
      updateOne: ([query, update]) => {
        if (!query || !update) {
          return Promise.resolve(null);
        }

        let found: ModelInstance<T> | undefined;

        const cache = Array.from(this.thisCache);

        if (typeof query === "string") {
          found = cache.find(r => r._id === query);
        } else {
          found = cache[0];

          if (query.filter) {
            const filterEntries = Object.entries(query.filter);
            found = cache.find(r =>
              filterEntries.every(
                ([key, value]) => (r.getData() as any)[key as unknown as keyof ModelData<typeof Model>] === value,
              ),
            );
          }
        }

        if (!found) {
          return Promise.resolve(null);
        }

        const data = { ...(found.getData() as any) };

        if (update.$set) {
          Object.assign(data, update.$set);
        }

        if (update.$unset) {
          Object.keys(update.$unset).forEach(key => {
            delete data[key as unknown as keyof ModelData<typeof Model>];
          });
        }

        found.setData(data);

        return Promise.resolve(found);
      },
      updateMultiple: ([query, update]) => {
        if (!query || !update) {
          return Promise.resolve([]);
        }

        const list = Array.from(this.thisCache);

        list.forEach(i => {
          const data = { ...(i.getData() as any) };

          if (update.$set) {
            Object.assign(data, update.$set);
          }

          if (update.$unset) {
            Object.keys(update.$unset).forEach(key => {
              delete data[key as unknown as keyof ModelData<typeof Model>];
            });
          }

          i.setData(data);
        });

        return Promise.resolve(list);
      },
      deleteOne: ([query]) => {
        if (!query) {
          return Promise.resolve(false);
        }

        const [first] = Array.from(this.thisCache);
        if (first) {
          this.thisCache.delete(first);
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      },
      deleteMultiple: ([query]) => {
        if (!query) {
          return Promise.resolve([]);
        }

        const ids = Array.from(this.thisCache).map(i => i._id);
        this.thisCache.clear();
        return Promise.resolve(ids as string[]);
      },
    };
  }

  return MockAdapter;
};

export const mockModel = <D extends ModelDefinition>(def?: D): typeof Model & { definition: D } => {
  return modelDecorator()(
    class extends Model {
      static slug = "a" + generateRandomString();
      static definition = def as any;

      constructor(doc: ModelData<typeof Model>) {
        super(doc);

        defineFieldsProperties(this);
      }
    },
  );
};

export const generateRandomString = () => {
  return "a" + Math.random().toString(36).substring(7);
};
