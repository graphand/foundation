import type { Model } from "@/lib/model.js";
import type { ModelList } from "@/lib/model-list.js";
import type { Property } from "@/lib/property.js";
import type { ErrorCodes } from "@/enums/error-codes.js";
import type { Validator } from "@/lib/validator.js";
import type { Adapter } from "@/lib/adapter.js";
import type { ValidationError } from "@/lib/validation-error.js";
import type { AuthProviders } from "@/enums/auth-providers.js";
import type { AuthMethods } from "@/enums/auth-methods.js";
import type { MergeRequestTypes } from "@/enums/merge-request-types.js";
import type { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
import type { PropertyDefinition, InferModelDef, InferModelDefInput, ModelJSON } from "@/types/properties.js";
import type { ValidatorDefinition } from "@/types/validators.js";
import type { TransactionCtx } from "./ctx.js";
import type { Account } from "@/models/account.js";
import type { Connector } from "@/models/connector.js";
import type { DataModel } from "@/models/data-model.js";
import type { Role } from "@/models/role.js";
import type { PromiseModelList } from "@/lib/promise-model-list.js";
import type { ModelInstance } from "./models.js";
export * from "./helpers.js";
export * from "./properties.js";
export * from "./validators.js";
export * from "./ctx.js";
export * from "./models.js";
export * from "./gdx.js";

export type Rule = NonNullable<ModelInstance<typeof Role>["rules"]>[number];
export type PropertiesRestriction = NonNullable<ModelInstance<typeof Role>["propertiesRestrictions"]>[number];
export type SerializerFormat = "json" | "object" | "validation" | "data";
export type PropertiesDefinition = Record<string, PropertyDefinition>;
export type ValidatorsDefinition = Array<ValidatorDefinition>;

export type JSONPrimitive =
  | undefined
  | null
  | string
  | number
  | Date
  | boolean
  | JSONArray
  | { [key: string]: JSONPrimitive };
export type JSONArray = Array<JSONPrimitive>;
export type JSONObject = Record<string, JSONPrimitive>;
export type JSONType = JSONObject | JSONArray;

export type Transaction<
  M extends typeof Model = typeof Model,
  A extends keyof AdapterFetcher<M> = keyof AdapterFetcher<M>,
  Args extends Parameters<NonNullable<AdapterFetcher<M>[A]>>[0] = Parameters<NonNullable<AdapterFetcher<M>[A]>>[0],
> = {
  model: M["configuration"]["slug"];
  action: A;
  args: Args;
  retryToken?: symbol;
  abortToken?: symbol;
  retries: number;
};

export type SortDirection =
  | 1
  | -1
  | "asc"
  | "desc"
  | "ascending"
  | "descending"
  | {
      $meta: string;
    };

export type Sort =
  | string
  | Exclude<
      SortDirection,
      {
        $meta: string;
      }
    >
  | string[]
  | {
      [key: string]: SortDirection;
    }
  | Record<string, SortDirection>
  | [string, SortDirection][]
  | [string, SortDirection];

export type Update = JSONObject;

export type Filter = string | JSONObject;

export type PopulateOption = {
  path: string;
  populate?: Populate;
  query?: JSONQuery;
};

export type PopulatePath = string | PopulateOption;

export type Populate = PopulatePath | PopulatePath[];

export type JSONQuery = Partial<{
  filter: Filter;
  sort: Sort;
  count: boolean;
  ids: string[];
  limit: number;
  skip: number;
  page: number;
  pageSize: number;
  populate: Populate;
  socket: string;
  update: Update;
}>;

export type UpdateObject = {
  $currentDate?: JSONObject;
  $inc?: JSONObject;
  $min?: JSONObject;
  $max?: JSONObject;
  $mul?: JSONObject;
  $rename?: JSONObject;
  $set?: JSONObject;
  $setOnInsert?: JSONObject;
  $unset?: JSONObject;
  $addToSet?: JSONObject;
  $pop?: JSONObject;
  $pull?: JSONObject;
  $push?: JSONObject;
  $pullAll?: JSONObject;
  $bit?: JSONObject;
};

export type AdapterFetcher<T extends typeof Model = typeof Model> = {
  count: (_args: [query: string | JSONQuery], _ctx: TransactionCtx) => Promise<number | null>;
  get: (_args: [query: string | JSONQuery], _ctx: TransactionCtx) => Promise<ModelInstance<T> | null>;
  getList: (_args: [query: JSONQuery], _ctx: TransactionCtx) => Promise<any>;
  createOne: (_args: [payload: InferModelDefInput<T, "data">], _ctx: TransactionCtx) => Promise<ModelInstance<T>>;
  createMultiple: (
    _args: [payload: Array<InferModelDefInput<T, "data">>],
    _ctx: TransactionCtx,
  ) => Promise<Array<ModelInstance<T>>>;
  updateOne: (
    _args: [query: string | JSONQuery, update: UpdateObject],
    _ctx: TransactionCtx,
  ) => Promise<ModelInstance<T> | null>;
  updateMultiple: (
    _args: [query: JSONQuery, update: UpdateObject],
    _ctx: TransactionCtx,
  ) => Promise<Array<ModelInstance<T>>>;
  deleteOne: (_args: [query: string | JSONQuery], _ctx: TransactionCtx) => Promise<boolean>;
  deleteMultiple: (_args: [query: JSONQuery], _ctx: TransactionCtx) => Promise<string[]>;
  initialize?: (_args: never, _ctx: TransactionCtx) => Promise<void>;
};

export type Module<T extends typeof Model = typeof Model> = (_model: T) => void;

export type HookPhase = "before" | "after";

export type HookCallbackArgs<
  P extends HookPhase,
  A extends keyof AdapterFetcher<T>,
  T extends typeof Model,
> = P extends "before"
  ? {
      args: Parameters<NonNullable<AdapterFetcher<T>[A]>>[0];
      ctx: TransactionCtx;
      transaction: Transaction<T, A>;
      err: Array<Error | symbol> | undefined;
    }
  : HookCallbackArgs<"before", A, T> & {
      res: ReturnType<NonNullable<AdapterFetcher<T>[A]>>;
    };

export type Hook<
  P extends HookPhase = HookPhase,
  A extends keyof AdapterFetcher<T> = keyof AdapterFetcher<typeof Model>,
  T extends typeof Model = typeof Model,
> = {
  phase: P;
  action: A;
  fn: (this: T, _args: HookCallbackArgs<P, A, T>) => void;
  order: number;
  handleErrors?: boolean;
  adapterClass?: typeof Adapter | Array<typeof Adapter>;
};

export type Jsonified<T> =
  T extends Promise<ModelInstance<infer M>>
    ? InferModelDef<M, "json">
    : T extends Promise<ModelInstance<infer M> | null>
      ? InferModelDef<M, "json"> | null
      : T extends Promise<ModelInstance<infer M>[]>
        ? InferModelDef<M, "json">[]
        : T extends ModelInstance<infer M>
          ? InferModelDef<M, "json">
          : T extends PromiseModelList<infer M>
            ? { rows: InferModelDef<M, "json">[]; count: number }
            : T extends Promise<ModelList<infer M>>
              ? { rows: InferModelDef<M, "json">[]; count: number }
              : T extends ModelList<infer M>
                ? { rows: InferModelDef<M, "json">[]; count: number }
                : T extends Error
                  ? { message: string; code: string }
                  : Awaited<T>;

export type HookData<
  P extends HookPhase = HookPhase,
  A extends keyof AdapterFetcher<T> = keyof AdapterFetcher<typeof Model>,
  T extends typeof Model = typeof Model,
> = {
  aborted?: boolean;
  event: keyof ModelInstance<typeof DataModel>["hooks"];
  request: {
    environment: string;
    token: string | undefined;
  };
  transaction: Jsonified<HookCallbackArgs<P, A, T>["transaction"]>;
  args: Jsonified<HookCallbackArgs<P, A, T>["args"]>;
  err: Jsonified<HookCallbackArgs<P, A, T>["err"]>;
  res?: P extends "before" ? undefined : Jsonified<HookCallbackArgs<"after", A, T>["res"]>;
  ctx: JSONObject;
};

export type ValidatorHook<
  P extends HookPhase = HookPhase,
  A extends keyof AdapterFetcher<T> = keyof AdapterFetcher<typeof Model>,
  T extends typeof Model = typeof Model,
> = [P, A, (_args: HookCallbackArgs<P, A, T>) => boolean];

export type CoreErrorDefinition = {
  message?: string;
  code?: ErrorCodes | string;
};

export type ValidationPropertyErrorDefinition = {
  slug: string;
  property: Property;
  validationError?: ValidationError;
  message?: string;
};

export type ValidationValidatorErrorDefinition = {
  validator: Validator;
  message?: string;
  value?: unknown;
};

export type ControllerInput = {
  params?: JSONObject;
  query?: JSONObject;
  data?: unknown;
};

export type Controller<I extends ControllerInput = ControllerInput> = {
  path: string;
  methods: Array<"get" | "post" | "put" | "delete" | "patch" | "options">;
  secured: boolean;
  input?: I;
};

export type InferControllerInput<C extends Controller<ControllerInput>> = C["input"] extends never ? never : C["input"];

export type LoginData<P extends AuthProviders = AuthProviders, M extends AuthMethods = AuthMethods> = {
  provider?: P;
  method?: M;
  credentials?: AuthProviderCredentials<P>;
  options?: AuthMethodOptions<M>;
};

export type RegisterData<P extends AuthProviders = AuthProviders, M extends AuthMethods = AuthMethods> = {
  provider?: P;
  method?: M;
  account?: Omit<ModelJSON<typeof Account>, "role">;
  configuration?: AuthProviderConfigurePayload<P>;
  options?: AuthMethodOptions<M>;
};

export type ConfigureData<P extends AuthProviders = AuthProviders> = {
  provider: P;
  configuration: AuthProviderConfigurePayload<P>;
};

export type ModelCrudEvent<T extends "create" | "update" | "delete" = any, M extends typeof Model = typeof Model> = {
  operation: T;
  model: M["configuration"]["slug"];
  ids: Array<string>;
  data: T extends "create" | "update" ? Array<ModelJSON<M>> : null;
};

export type UploadEvent = {
  type?: "progress" | "end" | "error" | "abort";
  uploadId: string;
  percentage?: number;
  contentLength?: number;
  receivedLength: number;
};

export type IdentityString = string;

export type PropertiesPathItem = { key: string; property: Property };

export type MergeRequestOptionsMap = {
  [MergeRequestTypes.STATIC]: {
    gdx: JSONObject;
  };
  [MergeRequestTypes.QUERY]: {
    source: string;
    query: Record<string, JSONQuery | true>;
  };
};

export type MergeRequestOptions<T extends MergeRequestTypes = keyof MergeRequestOptionsMap | MergeRequestTypes> =
  T extends keyof MergeRequestOptionsMap ? MergeRequestOptionsMap[T] : Record<string, never>;

export type MergeRequestActionDataMap = {
  [MergeRequestActionTypes.COMMENT]: {
    comment: string;
  };
  [MergeRequestActionTypes.PATCH]: {
    apply: JSONObject;
    comment?: string;
  };
  [MergeRequestActionTypes.APPROVE]: {
    close?: boolean;
  };
  [MergeRequestActionTypes.REJECT]: {
    comment?: string;
    close?: boolean;
  };
};

export type MergeRequestActionData<
  T extends MergeRequestActionTypes = keyof MergeRequestActionDataMap | MergeRequestActionTypes,
> = T extends keyof MergeRequestActionDataMap ? MergeRequestActionDataMap[T] : Record<string, never>;

export type AuthProviderCredentialsMap = {
  [AuthProviders.LOCAL]: {
    email: string;
    password: string;
  };
  [AuthProviders.GRAPHAND]: {
    resetAccount?: boolean;
  };
};

export type AuthProviderCredentials<T extends AuthProviders = keyof AuthProviderCredentialsMap | AuthProviders> =
  T extends keyof AuthProviderCredentialsMap ? AuthProviderCredentialsMap[T] : Record<string, never>;

export type AuthMethodOptionsMap = {
  [AuthMethods.REDIRECT]: {
    redirect?: string;
  };
};

export type AuthMethodOptions<T extends AuthMethods = keyof AuthMethodOptionsMap | AuthMethods> =
  T extends keyof AuthMethodOptionsMap ? AuthMethodOptionsMap[T] : Record<string, never>;

export type AuthProviderConfigurePayloadMap = {
  [AuthProviders.LOCAL]: {
    email?: string;
    password?: string;
    sendConfirmationEmail?: boolean;
    confirmEmailToken?: string;
    resetPasswordToken?: string;
    resetPassword?: boolean;
  };
  [AuthProviders.GRAPHAND]: {
    graphandToken?: string;
    unlink?: boolean;
  };
};

export type AuthProviderConfigurePayload<
  T extends AuthProviders = keyof AuthProviderConfigurePayloadMap | AuthProviders,
> = T extends keyof AuthProviderConfigurePayloadMap ? AuthProviderConfigurePayloadMap[T] : Record<string, never>;

type ConnectorEventTypes = "up" | "down" | "reset" | "create" | "update" | "delete";
export type ConnectorEvent<
  T extends ConnectorEventTypes = ConnectorEventTypes,
  M extends typeof Model = typeof Model,
> = {
  type: T;
  connector: ModelJSON<typeof Connector>;
  retries: number;
  data: T extends "create" | "update" ? Array<ModelJSON<M>> : T extends "delete" ? Array<string> : null;
};

export type MediaTransformOptions = {
  w?: number;
  h?: number;
  q?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
};
