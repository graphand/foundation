import type { Model } from "@/lib/Model.js";
import type { ModelList } from "@/lib/ModelList.js";
import type { Field } from "@/lib/Field.js";
import type { ErrorCodes } from "@/enums/error-codes.js";
import type { Validator } from "@/lib/Validator.js";
import type { Adapter } from "@/lib/Adapter.js";
import type { ValidationError } from "@/lib/ValidationError.js";
import type { AuthProviders } from "@/enums/auth-providers.js";
import type { AuthMethods } from "@/enums/auth-methods.js";
import type { MergeRequestTypes } from "@/enums/merge-request-types.js";
import type { MergeRequestEventTypes } from "@/enums/merge-request-event-types.js";
import type { FieldDefinition, InferModelDef, ModelJSON, SerializerFieldsMap } from "@/types/fields.js";
import type { ValidatorDefinition } from "@/types/validators.js";
import type { TransactionCtx } from "./ctx.js";
import type { Account } from "@/models/Account.js";
import type { Connector } from "@/models/Connector.js";
import type { DataModel } from "@/models/DataModel.js";
import type { Role } from "@/models/Role.js";
import type { PromiseModelList } from "@/lib/PromiseModelList.js";
import { ModelInstance } from "@/index.js";
export * from "./helpers.js";
export * from "./fields.js";
export * from "./validators.js";
export * from "./ctx.js";
export * from "./models.js";

export type Rule = NonNullable<ModelInstance<typeof Role>["rules"]>[number];
export type FieldsRestriction = NonNullable<ModelInstance<typeof Role>["fieldsRestrictions"]>[number];
export type SerializerFormat = keyof SerializerFieldsMap<FieldDefinition>;
export type FieldsDefinition = Record<string, FieldDefinition>;
export type ValidatorsDefinition = Array<ValidatorDefinition>;

export type JSONSubtype = null | string | number | Date | boolean | JSONSubtypeArray | { [key: string]: JSONSubtype };

export type JSONSubtypeArray = Array<JSONSubtype>;

export type JSONTypeObject = Record<string, JSONSubtype>;

export type JSONType = JSONTypeObject | JSONSubtypeArray;

export type Transaction<
  M extends typeof Model = typeof Model,
  A extends keyof AdapterFetcher<M> = keyof AdapterFetcher<M>,
  Args extends Parameters<NonNullable<AdapterFetcher<M>[A]>>[0] = Parameters<NonNullable<AdapterFetcher<M>[A]>>[0],
> = {
  model: M["slug"];
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

export type Filter = string | JSONTypeObject;

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
}>;

export type UpdateObject = {
  $currentDate?: JSONTypeObject;
  $inc?: JSONTypeObject;
  $min?: JSONTypeObject;
  $max?: JSONTypeObject;
  $mul?: JSONTypeObject;
  $rename?: JSONTypeObject;
  $set?: JSONTypeObject;
  $setOnInsert?: JSONTypeObject;
  $unset?: JSONTypeObject;
  $addToSet?: JSONTypeObject;
  $pop?: JSONTypeObject;
  $pull?: JSONTypeObject;
  $push?: JSONTypeObject;
  $pullAll?: JSONTypeObject;
  $bit?: JSONTypeObject;
};

export type AdapterFetcher<T extends typeof Model = typeof Model> = {
  count: (_args: [query: string | JSONQuery], _ctx: TransactionCtx) => Promise<number | null>;
  get: (_args: [query: string | JSONQuery], _ctx: TransactionCtx) => Promise<ModelInstance<T> | null>;
  getList: (_args: [query: JSONQuery], _ctx: TransactionCtx) => Promise<ModelList<T>>;
  createOne: (_args: [payload: ModelJSON<T>], _ctx: TransactionCtx) => Promise<ModelInstance<T>>;
  createMultiple: (_args: [payload: Array<ModelJSON<T>>], _ctx: TransactionCtx) => Promise<Array<ModelInstance<T>>>;
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
  ctx: JSONTypeObject;
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

export type ValidationFieldErrorDefinition = {
  slug: string;
  field: Field;
  validationError?: ValidationError;
  message?: string;
};

export type ValidationValidatorErrorDefinition = {
  validator: Validator;
  message?: string;
  value?: unknown;
};

export type ControllerInput = {
  params?: JSONTypeObject;
  query?: JSONTypeObject;
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
  model: M["slug"];
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

export type FieldsPathItem = { key: string; field: Field };

export type MergeRequestOptionsMap = {
  [MergeRequestTypes.STATIC]: {
    gdx: JSONTypeObject;
  };
  [MergeRequestTypes.QUERY]: {
    source: string;
    query: Record<string, JSONQuery | true>;
  };
};

export type MergeRequestOptions<T extends MergeRequestTypes = keyof MergeRequestOptionsMap | MergeRequestTypes> =
  T extends keyof MergeRequestOptionsMap ? MergeRequestOptionsMap[T] : Record<string, never>;

export type MergeRequestEventDataMap = {
  [MergeRequestEventTypes.COMMENT]: {
    comment: string;
  };
  [MergeRequestEventTypes.PATCH]: {
    apply: JSONTypeObject;
    comment?: string;
  };
  [MergeRequestEventTypes.APPROVE]: {
    close?: boolean;
  };
  [MergeRequestEventTypes.REJECT]: {
    comment?: string;
    close?: boolean;
  };
};

export type MergeRequestEventData<
  T extends MergeRequestEventTypes = keyof MergeRequestEventDataMap | MergeRequestEventTypes,
> = T extends keyof MergeRequestEventDataMap ? MergeRequestEventDataMap[T] : Record<string, never>;

export type AuthProviderCredentialsMap = {
  [AuthProviders.LOCAL]: {
    email: string;
    password: string;
  };
  [AuthProviders.GRAPHAND]: {
    reset?: boolean;
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
    resetPassword?: true;
  };
  [AuthProviders.GRAPHAND]: {
    graphandToken?: string;
    unlink?: true;
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
