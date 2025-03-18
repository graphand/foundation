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
import { InferModelDef, PropertiesDefinition, ValidatorsDefinition } from "@/index.js";
export * from "./helpers.js";
export * from "./properties.js";
export * from "./validators.js";
export * from "./ctx.js";

export type TModelConfiguration<TSlug extends string = string> = {
  slug: TSlug;
  loadDatamodel?: boolean;
  connectable?: boolean;
  restricted?: boolean;
  realtime?: boolean;
  type?: "object";
  blockMultipleOperations?: boolean;
  freeMode?: boolean;
  properties?: PropertiesDefinition;
  keyProperty?: string;
  single?: boolean | null;
  validators?: ValidatorsDefinition;
  isEnvironmentScoped?: boolean;
  isDynamic?: boolean;
  required?: string[];
};

export interface ModelsOverrides {}

export interface ModelsBase {
  [Account.configuration.slug]: typeof Account;
  [Aggregation.configuration.slug]: typeof Aggregation;
  [AuthProvider.configuration.slug]: typeof AuthProvider;
  [Connector.configuration.slug]: typeof Connector;
  [DataModel.configuration.slug]: typeof DataModel;
  [Environment.configuration.slug]: typeof Environment;
  [Event.configuration.slug]: typeof Event;
  [EventSubscription.configuration.slug]: typeof EventSubscription;
  [Function.configuration.slug]: typeof Function;
  [Invitation.configuration.slug]: typeof Invitation;
  [Job.configuration.slug]: typeof Job;
  [Media.configuration.slug]: typeof Media;
  [MergeRequest.configuration.slug]: typeof MergeRequest;
  [MergeRequestAction.configuration.slug]: typeof MergeRequestAction;
  [Role.configuration.slug]: typeof Role;
  [Secret.configuration.slug]: typeof Secret;
  [Settings.configuration.slug]: typeof Settings;
  [Snapshot.configuration.slug]: typeof Snapshot;
  [TokenIssuer.configuration.slug]: typeof TokenIssuer;
}

export type Models = Omit<ModelsBase, keyof ModelsOverrides> & ModelsOverrides;

export type DecodeRefModel<T extends string | keyof Models> = T extends keyof Models ? Models[T] : typeof Model;

export type ModelInstance<M extends typeof Model = typeof Model> = InstanceType<M> & InferModelDef<M, "object">;
