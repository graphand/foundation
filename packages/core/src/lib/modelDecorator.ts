import { Model } from "@/lib/Model.js";
import { defineFieldsProperties } from "@/lib/utils.js";

/**
 * A decorator that extends the model class with the defineFieldsProperties function in the constructor
 * @returns a decorator that extends the model class with the defineFieldsProperties function
 */
export const modelDecorator = (_?: any) => {
  return <T extends typeof Model>(model: T, _opts?: any) => {
    // @ts-expect-error decorator
    return class extends model {
      constructor(data: ModelData<T>) {
        super(data);

        defineFieldsProperties(this);
      }
    };
  };
};
