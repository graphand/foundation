import type { Model } from "@/lib/model.js";
import type { Account } from "@/models/account.js";
import type { Aggregation } from "@/models/aggregation.js";
import type { AuthProvider } from "@/models/auth-provider.js";
import type { Connector } from "@/models/connector.js";
import type { DataModel } from "@/models/data-model.js";
import type { Environment } from "@/models/environment.js";
import type { Job } from "@/models/job.js";
import type { Media } from "@/models/media.js";
import type { MergeRequest } from "@/models/merge-request.js";
import type { MergeRequestAction } from "@/models/merge-request-action.js";
import type { Role } from "@/models/role.js";
import type { Secret } from "@/models/secret.js";
import type { Settings } from "@/models/settings.js";
import type { TokenIssuer } from "@/models/token-issuer.js";
import type { Function } from "@/models/function.js";
import type { Event } from "@/models/event.js";
import type { Invitation } from "@/models/invitation.js";
import type { Snapshot } from "@/models/snapshot.js";
import type { EventSubscription } from "@/models/event-subscription.js";
import { FieldsDefinition, InferModelDef, ValidatorsDefinition } from "@/index.js";
export * from "./helpers.js";
export * from "./fields.js";
export * from "./validators.js";
export * from "./ctx.js";

export interface ModelsOverrides {}

export interface ModelsBase {
  [Account.slug]: typeof Account;
  [Aggregation.slug]: typeof Aggregation;
  [AuthProvider.slug]: typeof AuthProvider;
  [Connector.slug]: typeof Connector;
  [DataModel.slug]: typeof DataModel;
  [Environment.slug]: typeof Environment;
  [Event.slug]: typeof Event;
  [EventSubscription.slug]: typeof EventSubscription;
  [Function.slug]: typeof Function;
  [Invitation.slug]: typeof Invitation;
  [Job.slug]: typeof Job;
  [Media.slug]: typeof Media;
  [MergeRequest.slug]: typeof MergeRequest;
  [MergeRequestAction.slug]: typeof MergeRequestAction;
  [Role.slug]: typeof Role;
  [Secret.slug]: typeof Secret;
  [Settings.slug]: typeof Settings;
  [Snapshot.slug]: typeof Snapshot;
  [TokenIssuer.slug]: typeof TokenIssuer;
}

export type Models = Omit<ModelsBase, keyof ModelsOverrides> & ModelsOverrides;

export type DecodeRefModel<T extends string | keyof Models> = T extends keyof Models ? Models[T] : typeof Model;

export type ModelInstance<M extends typeof Model = typeof Model> = (M["definition"] extends ModelDefinition
  ? InstanceType<typeof Model>
  : unknown) &
  InstanceType<M> &
  InferModelDef<M, "object">;

export type ModelDefinition = Readonly<{
  keyField?: Readonly<string>;
  single?: Readonly<boolean>;
  fields?: Readonly<FieldsDefinition>;
  validators?: Readonly<ValidatorsDefinition>;
}>;
