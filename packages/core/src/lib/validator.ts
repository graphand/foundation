import { ValidatorTypes } from "@/enums/validator-types.js";
import {
  ModelInstance,
  TransactionCtx,
  ValidatorDefinition,
  ValidatorDefinitionGeneric,
  ValidatorHook,
  ValidatorOptions,
} from "@/types/index.js";
import { Model } from "@/lib/model.js";
import { getDefaultValidatorOptions } from "@/lib/utils.js";

export class Validator<T extends ValidatorTypes = ValidatorTypes> {
  #definition: ValidatorDefinitionGeneric<T>;
  #path: undefined | string;

  hooks: Array<ValidatorHook> | undefined;

  constructor(definition: ValidatorDefinitionGeneric<T>, path?: string) {
    this.#definition = definition;
    this.#path = path;
  }

  get type(): T {
    return this.#definition.type as T;
  }

  get path() {
    return this.#path;
  }

  get options(): ValidatorOptions<T> {
    const defaults = getDefaultValidatorOptions(this.type);

    return Object.assign({}, defaults, this.#definition.options ?? {}) as ValidatorOptions<T>;
  }

  getFullPath() {
    return [this.#path, this.options.property].filter(Boolean).join(".");
  }

  getKey() {
    return this.getFullPath() + this.type;
  }

  validate?: <T extends typeof Model>(_input: {
    list: Array<ModelInstance<T>>;
    model: T;
    ctx?: TransactionCtx;
  }) => Promise<boolean>;

  toJSON() {
    return {
      type: this.type,
      options: this.options,
      path: this.#path,
    };
  }

  static fromJSON(json: ReturnType<Validator["toJSON"]>) {
    const { type, options, path } = json;
    const definition = { type, options } as ValidatorDefinition;
    return new Validator(definition, path);
  }
}
