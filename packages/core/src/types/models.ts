import type { Model } from "@/lib/Model.js";
import type { Account } from "@/models/Account.js";
import type { Aggregation } from "@/models/Aggregation.js";
import type { AuthProvider } from "@/models/AuthProvider.js";
import type { Connector } from "@/models/Connector.js";
import type { DataModel } from "@/models/DataModel.js";
import type { Environment } from "@/models/Environment.js";
import type { Job } from "@/models/Job.js";
import type { Key } from "@/models/Key.js";
import type { Media } from "@/models/Media.js";
import type { MergeRequest } from "@/models/MergeRequest.js";
import type { MergeRequestEvent } from "@/models/MergeRequestEvent.js";
import type { Role } from "@/models/Role.js";
import type { Settings } from "@/models/Settings.js";
import type { Token } from "@/models/Token.js";
import type { Function } from "@/models/Function.js";
import { Event } from "@/models/Event.js";
import { Invitation } from "@/models/Invitation.js";
import { Snapshot } from "@/models/Snapshot.js";
import { EventSubscription } from "@/models/EventSubscription.js";
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
  [Key.slug]: typeof Key;
  [Media.slug]: typeof Media;
  [MergeRequest.slug]: typeof MergeRequest;
  [MergeRequestEvent.slug]: typeof MergeRequestEvent;
  [Role.slug]: typeof Role;
  [Settings.slug]: typeof Settings;
  [Snapshot.slug]: typeof Snapshot;
  [Token.slug]: typeof Token;
}

export type Models = Omit<ModelsBase, keyof ModelsOverrides> & ModelsOverrides;

export type DecodeRefModel<T extends string> = T extends keyof Models ? Models[T] : typeof Model;

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
