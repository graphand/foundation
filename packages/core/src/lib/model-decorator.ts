import { Model } from "@/lib/model.js";
import { defineFieldsProperties } from "@/lib/utils.js";
import type { ModelData } from "@/index.js";

/**
 * A decorator that extends the model class with the defineFieldsProperties function in the constructor
 * @returns a decorator that extends the model class with the defineFieldsProperties function
 */
export const modelDecorator = (_?: any) => {
  return <T extends typeof Model>(model: T, _opts?: any) => {
    // @ts-expect-error
    return class extends model {
      static __isDecorated = true;

      constructor(data: ModelData<T>) {
        super(data);

        defineFieldsProperties(this);
      }
    };
  };
};
