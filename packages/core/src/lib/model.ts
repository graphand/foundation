import { Property } from "@/lib/property.js";
import { PromiseModel } from "@/lib/promise-model.js";
import { PromiseModelList } from "@/lib/promise-model-list.js";
import {
  AdapterFetcher,
  PropertiesPathItem,
  Hook,
  HookCallbackArgs,
  HookPhase,
  JSONQuery,
  Module,
  ModelInstance,
  UpdateObject,
  Models,
  InferModelDef,
  JSONObject,
  SerializerFormat,
  TransactionCtx,
  SerializerCtx,
  Transaction,
  PropertiesDefinition,
  ModelJSON,
  InferModel,
  ModelData,
  ValidatorsDefinition,
  ModelObject,
  InferModelDefInput,
} from "@/types/index.js";
import { Adapter } from "@/lib/adapter.js";
import { Validator } from "@/lib/validator.js";
import {
  createPropertiesMap,
  createValidatorsArray,
  getPropertiesPathsFromPath,
  getRecursiveHooksFromModel,
  _getter,
  validateModel,
  assignDatamodel,
  getModelInitPromise,
  definePropertiesObject,
} from "@/lib/utils.js";
import { CoreError } from "@/lib/core-error.js";
import { ErrorCodes } from "@/enums/error-codes.js";
import { DataModel } from "@/models/data-model.js";
import { ModelList } from "./model-list.js";
import { PropertyTypes } from "@/enums/property-types.js";

export type TModelConfiguration<TSlug extends string = string> = {
  slug: TSlug;
  loadDatamodel?: boolean;
  connectable?: boolean;
  exposed?: boolean;
  realtime?: boolean;
  type?: "object";
  blockMultipleOperations?: boolean;
  freeMode?: boolean;
  properties?: PropertiesDefinition | null;
  keyProperty?: string;
  single?: boolean | null;
  validators?: ValidatorsDefinition;
  isEnvironmentScoped?: boolean;
  isDynamic?: boolean;
  required?: string[];
};

export const defineConfiguration = <const C extends TModelConfiguration>(configuration: C) => configuration;

const noPropertySymbol = Symbol("noProperty");

export class Model {
  static configuration: TModelConfiguration = { slug: "" };

  static adapterClass: typeof Adapter; // The adapter class to use with the model and inherited models

  static __name: string = "Model";
  static __hooks: Set<Hook<HookPhase, keyof AdapterFetcher, typeof Model>>;
  static __initOptions: Parameters<typeof getModelInitPromise>[1];
  static __initPromise: Promise<void>;
  static __adapter: Adapter;
  static __extendedClass: any;
  static __memo: {
    propertiesMap?: Map<string, Property>;
    validatorsArray?: Array<Validator | null>;
    propertiesKeys?: string[];
    propertiesObject?: PropertyDescriptorMap;
  };
  static systemProperties: PropertiesDefinition = {
    _id: { type: PropertyTypes.ID },
    _createdAt: { type: PropertyTypes.DATE },
    _createdBy: { type: PropertyTypes.IDENTITY },
    _updatedAt: { type: PropertyTypes.DATE },
    _updatedBy: { type: PropertyTypes.IDENTITY },
  };

  #data: unknown; // The document

  constructor(data: unknown = {}) {
    if (!data || typeof data !== "object") {
      throw new CoreError({
        message: `Invalid document: ${data}`,
      });
    }

    this.#data = data;
  }

  /**
   * Returns the current instance model constructor as a typeof Model.
   * instance.model is an alias for instance.constructor.
   */
  model<T extends ModelInstance>(this: T) {
    return this.constructor as InferModel<T>;
  }

  static getKeyProperty(): string {
    return this.configuration?.keyProperty ?? "_id";
  }

  static hydrate<T extends typeof Model>(this: T, data?: Partial<ModelData<T>>): ModelInstance<T> {
    return new this((data ?? {}) as ModelData<T>) as ModelInstance<T>;
  }

  /**
   * Serializes the model data into a specified format.
   * @param data - The data to be serialized.
   * @param format - The format to serialize the data into. Default is 'json'.
   * @param ctx - The serialization context.
   * @param clean - A boolean indicating whether to clean the data before serialization.
   * @returns The serialized data.
   * @example
   * const serializedData = Model.serialize(myData, 'json');
   */
  static serialize<S extends SerializerFormat, T extends typeof Model>(
    this: T,
    data?: InferModelDef<T, any>,
    format: S = "json" as S,
    ctx: SerializerCtx = {},
    clean = false,
  ) {
    // Create a new instance of the model with the provided data
    const i = new this((data ?? {}) as ModelData) as ModelInstance<T>;

    // Serialize the model instance into the specified format
    return i.serialize(format, ctx, clean);
  }

  /**
   * Returns the current instance doc (raw data)
   */
  getData<T extends ModelInstance>(this: T): ModelData<InferModel<T>> {
    return this.#data as ModelData<InferModel<T>>;
  }

  getKey<T extends ModelInstance<typeof Model>>(this: T, format?: SerializerFormat): string {
    const model = this.model();
    const keyProperty = model.getKeyProperty();

    if (!keyProperty) {
      throw new CoreError({
        message: `Invalid keyProperty for model ${model.configuration.slug} : ${keyProperty}`,
      });
    }

    return this.get(model.getKeyProperty(), format) as string;
  }

  getId<T extends ModelInstance>(this: T, format?: SerializerFormat): string {
    return this.get("_id", format) as string;
  }

  /**
   * Set the current instance data
   * @param data
   */
  setData<T extends ModelInstance>(this: T, data: ModelData) {
    if (!data || typeof data !== "object") {
      throw new CoreError({
        message: `Invalid data: ${data}`,
      });
    }

    this.#data = data;
  }

  /**
   * Clone the current model instance.
   * The cloned instance shares the same data with the original instance.
   * This method is useful when you want to break the reference to the original instance.
   * @example
   * const account = await models.Account.get();
   * const clonedAccount = account.clone();
   * console.log(account === clonedAccount); // false
   * console.log(account._email === clonedAccount._email); // true
   */
  clone<T extends ModelInstance>(this: T): T {
    return this.model().hydrate(this.#data as ModelData<InferModel<T>>) as T;
  }

  /**
   * The function returns the base class of a given model class. If the the current model class is extended (Model.extend),
   * the base class will be the class that was initially extended.
   */
  static getBaseClass<T extends typeof Model>(this: T): T {
    if (this.hasOwnProperty("__extendedClass") && this.__extendedClass) {
      return this.__extendedClass as T;
    }

    return this as T;
  }

  /**
   * Extends the current model with additional options and functionalities like an adapter or init options.
   * @param opts - An object containing options for the extension.
   * @param opts.adapterClass - The adapter class to be used with the model.
   * @param opts.initOptions - Initialization options for the model.
   * @param opts.modules - An array of modules to be applied to the model.
   * @param opts.register - A boolean indicating whether the model should be registered.
   * @param opts.force - A boolean indicating whether to force the extension even if the base class does not have a slug.
   * @returns The extended model.
   * @throws {CoreError} If the base class does not have a slug and the force option is not set.
   * @example
   * const ExtendedModel = Model.extend({
   *   adapterClass: MyAdapter,
   * });
   */
  static extend<T extends typeof Model>(
    this: T,
    opts: {
      adapterClass?: typeof Adapter;
      initOptions?: Parameters<typeof getModelInitPromise>[1];
      modules?: Array<Module<T>>;
      register?: boolean;
      force?: boolean;
    },
  ): T {
    // Get the base class of the current model
    const extendedClass = this.getBaseClass();

    // If the base class does not have a slug and the force option is not set, throw an error
    if (!extendedClass?.configuration?.slug && !opts.force) {
      throw new CoreError({
        message: "Cannot extend a model without slug",
      });
    }

    // @ts-expect-error Create a new class that extends the base class
    const model = class extends extendedClass {
      static __extendedClass = extendedClass;
    };

    // If initOptions are provided, set them on the model
    if (opts?.initOptions) {
      model.__initOptions = opts.initOptions;
    }

    // If an adapter class is provided, instantiate it with the model and set it on the model
    if (opts?.adapterClass) {
      const AdapterClass = opts.adapterClass;
      model.__adapter = new AdapterClass(model);
    }

    // If the register option is set or an adapter class is provided and the model has a slug, register the model
    if (opts?.register ?? (opts?.adapterClass && model.configuration.slug)) {
      opts?.adapterClass?.registerModel(model, opts?.force);
    }

    // If modules are provided, apply each module to the model
    if (opts?.modules?.length) {
      opts.modules.forEach(module => module(model));
    }

    // Return the extended model
    return model;
  }

  /**
   * Returns a promises that resolves when the model is initialized.
   */
  static async initialize() {
    if (this.hasOwnProperty("__initPromise")) {
      return this.__initPromise;
    }

    const baseClass = this.getBaseClass();
    if (!baseClass.hasOwnProperty("__isDecorated")) {
      throw new CoreError({
        message: `Model ${this.configuration.slug} is not decorated with modelDecorator. Please use the @modelDecorator() decorator on your model class.`,
      });
    }

    if (!this.hasOwnProperty("__initOptions")) {
      this.__initOptions = {};
    }

    this.__initPromise = getModelInitPromise(this, this.__initOptions);

    return this.__initPromise;
  }

  /**
   * Reload model from its definition (properties, validators, etc).
   * If the model is not extensible (Role, Token, etc.), this method does nothing.
   * @returns
   */
  static async reloadModel(opts?: {
    datamodel?: ModelJSON<typeof DataModel>;
    ctx?: TransactionCtx;
  }): Promise<ModelJSON<typeof DataModel> | undefined> {
    let { datamodel, ctx } = opts ?? {};
    const adapter = this.getAdapter();

    if (!datamodel) {
      datamodel = await Model.getClass("datamodels", adapter.base)
        .get(this.configuration.slug, ctx)
        .then(dm => dm?.toJSON())
        .catch(() => undefined);
    }

    if (datamodel) {
      assignDatamodel(this, datamodel);
    }

    return datamodel;
  }

  /**
   * Returns the properties map of the model.
   * The properties map could be incomplete if the model is extensible and is not initialized.
   */
  static get propertiesMap() {
    this.__memo ??= {};
    this.__memo.propertiesMap ??= createPropertiesMap(this);
    return this.__memo.propertiesMap;
  }

  /**
   * Returns the keys of the properties map of the model.
   * Equivalent to Array.from(model.propertiesMap.keys()).
   */
  static get propertiesKeys() {
    this.__memo ??= {};
    this.__memo.propertiesKeys ??= Array.from(this.propertiesMap.keys());
    return this.__memo.propertiesKeys;
  }

  /**
   * Returns an array of all validators of the model and its parents.
   * The validators array could be incomplete if the model is extensible and is not initialized.
   */
  static get validatorsArray() {
    this.__memo ??= {};
    this.__memo.validatorsArray ??= createValidatorsArray(this);
    return this.__memo.validatorsArray;
  }

  static get propertiesObject() {
    if (!this.__memo?.propertiesObject) {
      const properties: PropertyDescriptorMap = {};
      for (const slug of this.propertiesKeys) {
        properties[slug] = {
          enumerable: true,
          configurable: true,
          get() {
            const i = this as unknown as ModelInstance;
            return i.get(slug);
          },
          set() {
            throw new CoreError({
              message: `This object is immutable. Please use .update method instead`,
            });
          },
        };
      }

      this.__memo ??= {};
      this.__memo.propertiesObject = properties;
    }

    return this.__memo.propertiesObject;
  }

  /**
   * Retrieves the class of a model based on the provided input.
   * @param input - A slug (core model slug/datamodel slug), a model class or a datamodel instance.
   * @param adapterClass - The adapter class to be used with the model.
   * @returns The class of the model.
   * @throws {CoreError} If the input is invalid or if the model is already registered with a different class.
   * @example
   * const modelClass = Model.getClass('myModel');
   * const modelClass = Model.getClass(MyModel);
   * const modelClass = Model.getClass(datamodelInstance);
   */
  static getClass<
    M extends typeof Model | undefined = undefined,
    T extends string | keyof Models | ModelInstance<typeof DataModel> | typeof Model =
      | string
      | keyof Models
      | ModelInstance<typeof DataModel>
      | typeof Model,
  >(
    input: T,
    adapterClass?: typeof Adapter,
  ): M extends undefined ? (T extends typeof Model ? T : T extends keyof Models ? Models[T] : typeof Model) : M {
    // Throw an error if the input is not provided
    if (!input) {
      throw new CoreError({
        message: `Invalid input for getClass: ${input}`,
      });
    }

    // If no adapter class is provided, get the base adapter of the current model
    adapterClass ??= this.getAdapter(false)?.base;
    let slug: string | null | undefined;
    let realtime: boolean = false;
    let model: typeof Model | undefined;

    // If the input is a model class, get its slug and assign it to the model
    if (typeof input === "function" && "prototype" in input && input.prototype instanceof Model) {
      slug = input.configuration.slug;
      realtime = Boolean(input.configuration.realtime);
      model = input;
    }

    // If the slug is not defined, get it from the input if it's a string or a datamodel instance
    slug ??= typeof input === "string" ? input : (input as ModelInstance<typeof DataModel>).slug;
    realtime ??= typeof input === "string" ? false : Boolean((input as ModelInstance<typeof DataModel>).realtime);
    const dm: ModelInstance<typeof DataModel> | undefined = input instanceof Model && slug ? input : undefined;

    // If no adapter class is provided and the input is a datamodel instance, get its base adapter
    if (!adapterClass && dm) {
      adapterClass = dm.model().getAdapter(false)?.base;
    }

    if (!slug) {
      throw new CoreError({
        message: `Invalid slug: ${slug}`,
      });
    }

    // If the adapter class has the model, return it
    const adapterModel = adapterClass?.getClosestModel?.(slug) as ReturnType<typeof Model.getClass<M, T>>;
    if (adapterModel) {
      if (adapterModel.getAdapter(false)?.base === adapterClass) {
        if (model && adapterModel.getBaseClass() !== model.getBaseClass()) {
          throw new CoreError({
            message: `Model ${slug} is already registered with a different class`,
          });
        }

        return adapterModel;
      }

      model ??= adapterModel;
    }

    if (!model && !slug) {
      throw new CoreError({
        message: `Invalid slug: ${slug}`,
      });
    }

    // If the model is not fount yet, we deduce it to be a generic model extended with a datamodel instance (extensible and environment scoped)
    model ??= class extends Model {
      static __isDecorated = true;
      static __name = `Data<${slug}>`;
      static configuration = defineConfiguration({
        slug: slug!,
        realtime,
        connectable: true,
        loadDatamodel: true,
        isEnvironmentScoped: true,
        isDynamic: true,
      });

      constructor(data: object) {
        super(data);

        definePropertiesObject(this);
      }
    };

    // If an adapter class is provided, extend the model with it
    if (adapterClass) {
      model = model.extend({
        adapterClass,
        initOptions: { datamodel: dm?.toJSON() },
        register: !adapterClass.hasModel(slug) || model.getAdapter(false)?.base !== adapterClass,
      });
    }

    // If the input is a datamodel instance, assign it to the model
    if (dm) {
      assignDatamodel(model, dm?.toJSON());
    }

    return model as any;
  }

  /**
   * Get value for a specific property. model.get("property") is an equivalent to `model.property`
   * @param path - The path to the property
   * @param format - The format to serialize the value (default object)
   * @example
   * console.log(model.get("property"));
   * console.log(model.get("property.subproperty.arr.nested"));
   * console.log(model.get("property.subproperty.arr.[1].nested"));
   */
  get<T extends ModelInstance, P extends string, S extends SerializerFormat = "object">(
    this: T,
    path: P,
    format: S = "object" as S,
    ctx: SerializerCtx = {},
    override?: unknown,
  ):
    | (T extends ModelInstance<infer R extends typeof Model>
        ? P extends keyof InferModelDef<R, S>
          ? InferModelDef<R, S>[P]
          : unknown
        : unknown)
    | undefined {
    ctx.outputFormat ??= format;
    const model = this.model();
    let propertiesPaths: Array<PropertiesPathItem | null> | undefined;

    if (path.includes(".") || path.includes("[")) {
      // Parse the path to handle cases like "property[0].subproperty" to follow the dot notation
      const sanitizedPath = path.replace(/([^.])\[/g, "$1.[");
      propertiesPaths = getPropertiesPathsFromPath(this.model(), sanitizedPath.split("."));
    } else {
      if (model.propertiesMap.has(path)) {
        const property = model.propertiesMap.get(path) as Property;
        propertiesPaths = [{ property, key: path }];
      }
    }

    const value = override ?? this.getData() ?? {};

    if (!propertiesPaths?.length) {
      if (model.configuration.freeMode) {
        // @ts-ignore
        return value[path] as any;
      }

      return undefined;
    }

    try {
      return _getter({ value, propertiesPaths, format, ctx, noPropertySymbol, from: this }) as any;
    } catch (e) {
      if (e === noPropertySymbol) {
        return undefined;
      }

      throw e;
    }
  }

  /**
   * The `refreshData` function asynchronously retrieves new data from a model and updates the current
   * data with it.
   * @param {TransactionCtx} [ctx] - The transaction context.
   */
  async refreshData<T extends ModelInstance>(this: T, ctx?: TransactionCtx) {
    const _id = this.get("_id", "json") as string;
    const newData = await this.model().execute("get", [_id], ctx);
    if (!newData) {
      throw new CoreError({
        message: `Unable to refresh data on model ${this.model().configuration.slug}. New data is ${newData}`,
      });
    }

    this.setData(newData.getData());
    return this;
  }

  /**
   * Get the document representation of the current instance with the given format
   * @param format
   * @param ctx
   * @param clean - if true, the result object will be cleaned from undefined values
   * @param propertiesKeys - an array of properties to serialize. If not provided, all properties will be serialized
   * @example
   * console.log(instance.serialize("json")); // equivalent to instance.toJSON()
   */
  serialize<T extends ModelInstance, S extends SerializerFormat>(
    this: T,
    format: S,
    bindCtx: SerializerCtx = {},
    clean = false,
    propertiesKeys?: Array<string>,
  ): InferModelDef<InferModel<T>, S> {
    const keys = propertiesKeys ?? this.model().propertiesKeys;
    const res: JSONObject = {};

    keys.forEach(slug => {
      const v = this.get(slug, format, bindCtx);
      if (!clean || v !== undefined) {
        res[slug] = v as any;
      }
    });

    return res as InferModelDef<InferModel<T>, S>;
  }

  /**
   * Get the document representation of the current instance as JSON
   * @example
   * console.log(instance.toJSON()); // equivalent to instance.to("json")
   */
  toJSON<T extends ModelInstance>(this: T): ModelJSON<InferModel<T>> {
    return this.serialize("json") as ModelJSON<InferModel<T>>;
  }

  /**
   * Get the document representation of the current instance as an object
   * @example
   * console.log(instance.toObject()); // equivalent to instance.to("object")
   */
  toObject<T extends ModelInstance>(this: T): ModelObject<InferModel<T>> {
    return this.serialize("object") as ModelObject<InferModel<T>>;
  }

  /**
   * Count the number of documents with the given query.
   * If Model.single is true, the result will always be 1.
   * @param query - a JSONQuery object (or a string) that contains the filter to apply and other settings
   * @example
   * const count = await Model.count({ filter: { title: { "$regex": "a" } } });
   */
  static async count<T extends typeof Model>(
    this: T,
    query: string | JSONQuery = {},
    ctx?: TransactionCtx,
  ): Promise<number> {
    return new Promise<number>(async (resolve, reject) => {
      try {
        await this.initialize();

        if (this.configuration.single) {
          return resolve(1);
        }

        const count = await this.execute("count", [query], ctx);
        resolve(count || 0);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Return a PromiseModel instance that will resolve to the first document that match the given query.
   * @param query - a JSONQuery object (or a string) that contains the filter to apply and other settings
   * @example
   * const instance = await Model.get({ filter: { title: { "$regex": "a" } } });
   * console.log(instance.title); // "apple"
   */
  static get<T extends typeof Model = typeof Model>(
    this: T,
    query: string | JSONQuery = {},
    ctx?: TransactionCtx,
  ): PromiseModel<T> {
    return new PromiseModel<T>(
      [
        async (resolve, reject) => {
          try {
            await this.initialize();

            const i = await this.execute("get", [query], ctx);
            resolve(i as ModelInstance<T>);
          } catch (e) {
            reject(e);
          }
        },
      ],
      this,
      query,
    );
  }

  /**
   * Return a PromiseModelList instance that will resolve to a ModelList instance that contains all documents that match the given query.
   * The default limit/pageSize is 100.
   * You cannot use this method on a single model, use Model.get instead.
   * @param query - a JSONQuery object that contains the filter to apply and other settings
   * @example
   * const list = await Model.getList({ filter: { title: { "$regex": "a" } } });
   * console.log(list.count); // 2
   * console.log(list[0].title); // "apple"
   * console.log(list[1].title); // "banana"
   */
  static getList<T extends typeof Model>(this: T, query: JSONQuery = {}, ctx?: TransactionCtx): PromiseModelList<T> {
    return new PromiseModelList<T>(
      [
        async (resolve, reject) => {
          try {
            await this.initialize();

            const list = await this.execute("getList", [query], ctx);
            resolve(list as ModelList<T>);
          } catch (e) {
            reject(e);
          }
        },
      ],
      this,
      query,
    );
  }

  /**
   * Create a new single document based on the current model.
   * @param payload - the content of the document to create
   * @example
   * const instance = await Model.create({ title: "apple" });
   * console.log(instance._id); // ...
   * console.log(instance.title); // "apple"
   */
  static async create<T extends typeof Model>(
    this: T,
    payload: InferModelDefInput<T, "json">,
    ctx?: TransactionCtx,
  ): Promise<ModelInstance<T>> {
    if (Array.isArray(payload)) {
      throw new CoreError({
        code: ErrorCodes.INVALID_PARAMS,
        message: `Payload is an array, use createMultiple instead`,
      });
    }

    await this.initialize();

    const adapter = this.getAdapter(false);
    const dataFormat = adapter?.base.dataFormat;

    let data: InferModelDefInput<T, "data">;

    if (dataFormat !== "json") {
      // Transform json payload into data format
      const tmp = new this(payload) as ModelInstance<T>;

      if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
        await this.validate([tmp], ctx);
      }

      data = tmp.serialize(dataFormat, { defaults: false }, true) as InferModelDefInput<T, "data">;
    } else {
      data = payload;
    }

    const i = await this.execute("createOne", [data], ctx);

    if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
      await this.validate([i], ctx);
    }

    return i as ModelInstance<T>;
  }

  /**
   * Create multiple documents based on the current model.
   * That method returns an array of created instances (not a ModelList).
   * Use this instead of calling Model.create multiple times.
   * @param payload - an array of documents content to create
   * @example
   * const instances = await Model.createMultiple([
   *  { title: "apple" },
   * { title: "banana" },
   * ]);
   * console.log(instances.length); // 2
   * console.log(instances[0].title); // "apple"
   * console.log(instances[1].title); // "banana"
   */
  static async createMultiple<T extends typeof Model>(
    this: T,
    payload: Array<InferModelDefInput<T, "json">>,
    ctx?: TransactionCtx,
  ): Promise<Array<ModelInstance<T>>> {
    await this.initialize();

    const array = Array.isArray(payload) ? payload : [payload];

    const adapter = this.getAdapter(false);
    const dataFormat = adapter?.base.dataFormat;

    let data: InferModelDefInput<T, "data">[];

    if (dataFormat !== "json") {
      const tmp = array.map(p => new this(p) as ModelInstance<T>);

      if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
        await this.validate(tmp, ctx);
      }

      data = tmp.map(i => i.serialize(dataFormat, { defaults: false }, true) as InferModelDefInput<T, "data">);
    } else {
      data = array;
    }

    const list = await this.execute("createMultiple", [data], ctx);

    if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
      await this.validate(list, ctx);
    }

    return list as Array<ModelInstance<T>>;
  }

  /**
   * Update a single document (the current instance) with a mongodb update object.
   * @param update - The mongodb update object to apply (Contains only update operators expressions - https://www.mongodb.com/docs/manual/reference/operator/update/#update-operators-1)
   * @example
   * const instance = await Model.create({ title: "apple" });
   * await instance.update({ $set: { title: "banana" } });
   * console.log(instance.title); // "banana"
   * await instance.update({ $unset: { title: true } });
   * console.log(instance.title); // undefined
   */
  async update<T extends ModelInstance>(this: T, update: UpdateObject, ctx?: TransactionCtx): Promise<T> {
    await this.model().initialize();

    const adapter = this.model().getAdapter(false);

    const res = await this.model().execute("updateOne", [String(this.get("_id")), update], ctx);

    if (!res?.getData?.()) {
      throw new CoreError({
        message: `Unable to update instance on model ${this.model().configuration.slug}`,
      });
    }

    if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
      await this.model().validate([res], ctx);
    }

    this.setData(res.getData());

    return this;
  }

  /**
   * Update one document that match the given query.
   * This method is just a shortcut for Model.get with query then instance.update on result
   * @param query
   * @param update
   * @example
   * await Model.createMultiple([
   * { title: "apple" },
   * { title: "banana" },
   * ]);
   * const updated = await Model.updateOne({ filter: { title: { "$regex": "a" } } }, { $set: { title: "pear" } });
   * console.log(updated.title); // "pear"
   */
  static async updateOne<T extends typeof Model>(
    this: T,
    query: string | JSONQuery = {},
    update: UpdateObject,
    ctx?: TransactionCtx,
  ): Promise<ModelInstance<T>> {
    await this.initialize();

    const i = await this.get(query);

    if (!i) {
      throw new CoreError({
        code: ErrorCodes.NOT_FOUND,
        message: `Unable to updateOne on model ${this.configuration.slug}: instance not found`,
      });
    }

    await i.update(update, ctx);

    return i;
  }

  /**
   * Update one or multiple documents that match the given query with a mongodb update object.
   * This method returns an array of updated instances (not a ModelList).
   * Use this instead of calling Model.prototype.update multiple times.
   * @param query - a JSONQuery object (or a string) that contains the filter to apply and other settings
   * @param update - The mongodb update object to apply (Contains only update operators expressions - https://www.mongodb.com/docs/manual/reference/operator/update/#update-operators-1)
   * @example
   * const instances = await Model.createMultiple([
   * { title: "apple" },
   * { title: "banana" },
   * ]);
   * const list = await Model.update({ filter: { title: { "$regex": "a" } } }, { $set: { title: "pear" } });
   * console.log(list.length); // 2
   * console.log(list[0].title); // "pear"
   * console.log(list[1].title); // "pear"
   */
  static async update<T extends typeof Model>(
    this: T,
    query: string | JSONQuery = {},
    update: UpdateObject,
    ctx?: TransactionCtx,
  ): Promise<Array<ModelInstance<T>>> {
    await this.initialize();

    const adapter = this.getAdapter(false);

    if (typeof query === "string") {
      const updated = await this.execute("updateOne", [query, update], ctx);

      if (!updated) {
        return [];
      }

      if (adapter?.base.runWriteValidators && !ctx?.disableValidation) {
        await this.validate([updated], ctx);
      }

      return [updated];
    }

    const list = await this.execute("updateMultiple", [query, update], ctx);

    if (list && adapter?.base.runWriteValidators && !ctx?.disableValidation) {
      await this.validate(list, ctx);
    }

    return list;
  }

  /**
   * Delete a single document (the current instance).
   * @example
   * const instance = await Model.create({ title: "apple" });
   * await instance.delete();
   */
  async delete<T extends ModelInstance>(this: T, ctx?: TransactionCtx): Promise<T> {
    await this.model().initialize();

    const _id = this.get("_id", "json") as string;
    await this.model().execute("deleteOne", [_id], ctx);

    return this;
  }

  /**
   * Delete one or multiple documents that match the given query.
   * That method returns an array of deleted ids.
   * Use this instead of calling Model.prototype.delete multiple times.
   * @param query - a JSONQuery object (or a string) that contains the filter to apply and other settings
   * @example
   * const instances = await Model.createMultiple([
   * { title: "apple" },
   * { title: "banana" },
   * ]);
   * const list = await Model.delete({ filter: { title: { "$regex": "a" } } });
   * console.log(list.length); // 2
   * console.log(list[0]); // ...
   * console.log(list[1]); // ...
   */
  static async delete<T extends typeof Model>(
    this: T,
    query: string | JSONQuery = {},
    ctx?: TransactionCtx,
  ): Promise<string[]> {
    await this.initialize();

    if (typeof query === "string") {
      const deleted = await this.execute("deleteOne", [query], ctx);
      if (deleted) {
        return [query];
      }

      return [];
    }

    return await this.execute("deleteMultiple", [query], ctx);
  }

  /**
   * Add hook to the current model baseClass (every adapted model with the same baseClass will inherit the hook).
   * @param phase - before | after
   * @param action - The action when the hook will be triggered. actions are keys of the adapter fetcher
   * @param fn - The hook function
   * @example
   * Account.hook("before", "createOne", async (payload, ctx) => {
   *  // will be triggered every time a single account is created with Account.create()
   * });
   */
  static hook<P extends HookPhase, A extends keyof AdapterFetcher, T extends typeof Model>(
    this: T,
    phase: Hook<P, A, T>["phase"],
    action: Hook<P, A, T>["action"],
    fn: Hook<P, A, T>["fn"],
    opts?: {
      order?: Hook<P, A, T>["order"];
      handleErrors?: Hook<P, A, T>["handleErrors"];
      adapterClass?: Hook<P, A, T>["adapterClass"];
    },
  ) {
    // if (
    //   this.configuration.blockMultipleOperations &&
    //   ["createMultiple", "updateMultiple", "deleteMultiple"].includes(action)
    // ) {
    //   console.warn(`Useless hook ${action} on a model with blockMultipleOperations (${this.configuration?.slug})`);
    // }

    if (!this.hasOwnProperty("__hooks") || !this.__hooks) {
      this.__hooks = new Set();
    }

    const hook: Hook<P, A, T> = {
      phase,
      action,
      fn,
      order: opts?.order || 0,
      handleErrors: opts?.handleErrors || false,
      adapterClass: opts?.adapterClass,
    };

    this.__hooks.add(hook as any);
  }

  /**
   * Validate multiple documents with the current model validators.
   * This method will throw an error if one of the input documents is invalid.
   * @param list - An array of documents to validate
   * @example
   * const instances = await Model.createMultiple([
   * { title: "apple" },
   * { title: "banana" },
   * ]);
   * await Model.validate(instances); // will validate the two instances with the model validators and either throw an error or return true
   */
  static async validate<T extends typeof Model>(
    this: T,
    list: Array<Partial<ModelData<T>> | ModelInstance<T>>,
    ctx?: TransactionCtx,
  ): Promise<boolean> {
    return await validateModel(this, list, ctx);
  }

  /**
   * The function `getAdapter` returns the adapter for a model class, throwing an error if no adapter
   * is found and required is set to true.
   * @param {T}  - - `T`: A generic type that extends `typeof Model`, which represents the class of a
   * model.
   * @param [required=true] - The `required` parameter is a boolean flag that indicates whether an
   * adapter is required for the model. If `required` is set to `true` and no adapter is found, an
   * error will be thrown. If `required` is set to `false` and no adapter is found, `null
   * @returns the adapter object.
   */
  static getAdapter<T extends typeof Model>(this: T, required = true): Adapter<T> {
    if (!this.hasOwnProperty("__adapter")) {
      const baseClass = this.getBaseClass();
      if (baseClass?.adapterClass) {
        this.__adapter = new baseClass.adapterClass(this);
      } else if (globalThis.__GLOBAL_ADAPTER__) {
        this.__adapter = new globalThis.__GLOBAL_ADAPTER__(this);
      }
    }

    if (!this.__adapter && required) {
      throw new CoreError({
        code: ErrorCodes.INVALID_ADAPTER,
        message: `invalid adapter on model ${this.__name}. Please define an adapter for this model or a global adapter class on Model.adapterClass`,
      });
    }

    return this.__adapter as Adapter<T>;
  }

  /**
   * The function checks if the adapter class has changed for a given model.
   * @param {T}  - - `T`: a generic type that extends `typeof Model`, which means it must be a subclass
   * of the `Model` class.
   * @returns a boolean value. It returns true if the adapter's base is not equal to the adapter class,
   * and false otherwise.
   */
  static hasAdapterClassChanged<T extends typeof Model>(this: T) {
    const adapter = this.getAdapter(false);
    if (!adapter) {
      return false;
    }

    return adapter.base !== this.adapterClass;
  }

  static async executeHooks<M extends typeof Model, P extends HookPhase, A extends keyof AdapterFetcher>(
    this: M,
    phase: P,
    action: A,
    payload: HookCallbackArgs<P, A, M>,
    transaction: Transaction<M, A>,
  ): Promise<void> {
    const hooks = await getRecursiveHooksFromModel(this, action, phase);
    const executed = new Set();

    try {
      await hooks.reduce(async (p, hook) => {
        await p;

        if (payload.err?.length) {
          return;
        }

        executed.add(hook);
        await hook.fn.call(this, payload);
      }, Promise.resolve());
    } catch (e) {
      if (transaction.abortToken === e) {
        throw new CoreError({
          code: ErrorCodes.EXECUTION_ABORTED,
          message: `execution on model ${this.__name} has been aborted`,
        });
      }

      payload.err ??= [];
      payload.err.push(e as Error);
    }

    if (payload.err?.length) {
      const handleErrorsHooks = hooks.filter(h => h.handleErrors && !executed.has(h));

      await handleErrorsHooks.reduce(async (p, h) => {
        await p;

        try {
          executed.add(h);
          await h.fn.call(this, payload);
        } catch (e) {
          payload.err?.push(e as Error);
        }
      }, Promise.resolve());
    }
  }

  static async execute<M extends typeof Model, const A extends keyof AdapterFetcher>(
    this: M,
    action: A,
    args: Parameters<NonNullable<AdapterFetcher<M>[A]>>[0],
    ctx: TransactionCtx = {},
    transaction?: Transaction<M, A, Parameters<NonNullable<AdapterFetcher<M>[A]>>[0]>,
  ): Promise<ReturnType<NonNullable<AdapterFetcher<M>[A]>>> {
    if (!ctx?.forceOperation) {
      if (
        this.configuration.single &&
        ["getList", "createOne", "createMultiple", "updateMultiple", "deleteOne", "deleteMultiple"].includes(action)
      ) {
        throw new CoreError({
          code: ErrorCodes.INVALID_OPERATION,
          message: `Cannot run ${action} operation on a single model (${this.configuration.slug})`,
        });
      }

      if (
        this.configuration.blockMultipleOperations &&
        ["createMultiple", "updateMultiple", "deleteMultiple"].includes(action)
      ) {
        throw new CoreError({
          code: ErrorCodes.INVALID_OPERATION,
          message: `Cannot run ${action} operation a model with blockMultipleOperations (${this.configuration.slug})`,
        });
      }
    }

    transaction ??= {
      model: this.configuration.slug,
      action,
      args,
      retryToken: Symbol("retry"),
      abortToken: Symbol("abort"),
      retries: -1,
    };

    transaction.retries += 1;

    if (transaction.retries > 2) {
      throw new CoreError({
        // code: ErrorCodes.TOO_MANY_RETRIES,
        message: `Too many retries on model ${this.configuration.slug} for action ${action}`,
      });
    }

    const payloadBefore: HookCallbackArgs<"before", A, M> = {
      args,
      ctx,
      transaction,
      err: undefined,
    };

    let res: Awaited<ReturnType<NonNullable<AdapterFetcher[A]>>> | undefined;

    await this.executeHooks("before", action, payloadBefore, transaction);

    if (payloadBefore.err?.length) {
      if (transaction.retryToken && payloadBefore.err?.includes(transaction.retryToken)) {
        return await this.execute(action, args, ctx, transaction);
      }

      throw payloadBefore.err.at(-1);
    }

    try {
      const fn = this.getAdapter().fetcher?.[action];

      if (!fn) {
        throw new CoreError({
          code: ErrorCodes.INVALID_OPERATION,
          message: `Invalid operation ${action} on model ${this.configuration.slug}. Action not found in adapter fetcher`,
        });
      }

      // @ts-ignore
      res = await fn.apply(fn, [payloadBefore.args, ctx]);
    } catch (e) {
      payloadBefore.err ??= [];
      payloadBefore.err.push(e as Error);
    }

    const payloadAfter: HookCallbackArgs<"after", A, M> = {
      ...payloadBefore,
      res: res as Awaited<ReturnType<NonNullable<AdapterFetcher[A]>>>,
    };

    await this.executeHooks("after", action, payloadAfter, transaction);

    if (payloadAfter.err?.length) {
      if (transaction.retryToken && payloadAfter.err.includes(transaction.retryToken)) {
        return await this.execute(action, args, ctx, transaction);
      }

      throw payloadAfter.err.at(-1);
    }

    return payloadAfter.res as ReturnType<NonNullable<AdapterFetcher[A]>>;
  }

  [Symbol.toPrimitive]<T extends ModelInstance>(this: T, hint: string): any {
    if (hint === "string") {
      return String(this.getId());
    }

    return this.toJSON();
  }
}
