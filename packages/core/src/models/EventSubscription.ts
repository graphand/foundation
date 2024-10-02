import { FieldTypes } from "@/enums/field-types.js";
import { SubscriptionChannels } from "@/enums/subscription-channels.js";
import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { ModelDefinition } from "@/types/index.js";
import { Account } from "./Account.js";
import { Role } from "./Role.js";
import { ValidatorTypes } from "../enums/validator-types.js";
import { Patterns } from "../enums/patterns.js";

@modelDecorator()
export class EventSubscription extends Model {
  static __name = "EventSubscription";
  static slug = "eventSubscriptions" as const;
  static definition = {
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      enabled: { type: FieldTypes.BOOLEAN, options: { default: true } },
      filter: { type: FieldTypes.NESTED }, // Filter to limit the subscription to specific events
      channels: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.NESTED,
            options: {
              strict: true,
              fields: {
                channel: {
                  type: FieldTypes.TEXT,
                  options: { enum: Object.values(SubscriptionChannels), strict: true },
                },
                options: {
                  type: FieldTypes.NESTED,
                  options: {
                    strict: true,
                    dependsOn: "$.channel",
                    fields: {
                      [SubscriptionChannels.EMAIL]: {
                        type: FieldTypes.NESTED,
                        options: {
                          fields: {
                            value: { type: FieldTypes.TEXT },
                          },
                        },
                      },
                      [SubscriptionChannels.ACCOUNT]: {
                        type: FieldTypes.NESTED,
                        options: {
                          fields: {
                            value: { type: FieldTypes.RELATION, options: { ref: Account.slug } },
                            field: { type: FieldTypes.TEXT },
                          },
                        },
                      },
                      [SubscriptionChannels.ROLE]: {
                        type: FieldTypes.NESTED,
                        options: {
                          fields: {
                            value: { type: FieldTypes.RELATION, options: { ref: Role.slug } },
                          },
                        },
                      },
                      [SubscriptionChannels.SLACK]: {
                        type: FieldTypes.NESTED,
                        options: {
                          fields: {
                            webhookUrl: { type: FieldTypes.TEXT },
                          },
                        },
                      },
                    },
                    validators: [
                      { type: ValidatorTypes.REQUIRED, options: { field: SubscriptionChannels.EMAIL } },
                      { type: ValidatorTypes.REQUIRED, options: { field: SubscriptionChannels.ACCOUNT } },
                      { type: ValidatorTypes.REQUIRED, options: { field: SubscriptionChannels.ROLE } },
                      { type: ValidatorTypes.REQUIRED, options: { field: SubscriptionChannels.SLACK } },
                      {
                        type: ValidatorTypes.REQUIRED,
                        options: { field: [SubscriptionChannels.EMAIL, "value"].join(".") },
                      },
                      {
                        type: ValidatorTypes.REGEX,
                        options: { pattern: Patterns.EMAIL, field: [SubscriptionChannels.EMAIL, "value"].join(".") },
                      },
                      {
                        type: ValidatorTypes.REQUIRED,
                        options: { field: [SubscriptionChannels.ROLE, "value"].join(".") },
                      },
                      {
                        type: ValidatorTypes.REQUIRED,
                        options: { field: [SubscriptionChannels.SLACK, "webhookUrl"].join(".") },
                      },
                      {
                        type: ValidatorTypes.REGEX,
                        options: { pattern: Patterns.URL, field: [SubscriptionChannels.SLACK, "webhookUrl"].join(".") },
                      },
                    ],
                  },
                },
              },
              validators: [
                { type: ValidatorTypes.REQUIRED, options: { field: "channel" } },
                { type: ValidatorTypes.REQUIRED, options: { field: "options" } },
              ],
            },
          },
        },
      },
    },
    validators: [{ type: ValidatorTypes.BOUNDARIES, options: { field: "channels", min: 1 } }],
  } satisfies ModelDefinition;
}
