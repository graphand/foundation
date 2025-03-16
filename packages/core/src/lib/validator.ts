import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelInstance, TransactionCtx, ValidatorDefinitionGeneric, ValidatorHook } from "@/types/index.js";
import { Model } from "@/lib/model.js";

export class Validator<T extends ValidatorTypes = ValidatorTypes> {
  #definition: ValidatorDefinitionGeneric<T>;
  #path: undefined | string;

  hooks: Array<ValidatorHook> | undefined;

  constructor(definition: ValidatorDefinitionGeneric<T>, path?: string) {
    this.#definition = definition;
    this.#path = path;

    // TODO : remove this once we have a proper way to handle options
    if ("options" in this.#definition && this.#definition.options) {
      throw new Error("options is not allowed in validator definition");
    }
  }

  get type(): T {
    return this.#definition.type as T;
  }

  get path() {
    return this.#path;
  }

  get definition(): ValidatorDefinitionGeneric<T> {
    return this.#definition;
  }

  getFullPath() {
    if ("property" in this.definition) {
      return [this.#path, this.definition.property].filter(Boolean).join(".");
    }

    return this.#path;
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
      ...this.#definition,
      _path: this.#path,
    };
  }

  static fromJSON(json: ReturnType<Validator["toJSON"]>) {
    const { _path, ...definition } = json;
    return new Validator(definition, _path);
  }
}
