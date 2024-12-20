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
                    fields: {
                      email: { type: FieldTypes.TEXT },
                      account: { type: FieldTypes.RELATION, options: { ref: Account.slug } },
                      accountField: { type: FieldTypes.TEXT },
                      role: { type: FieldTypes.RELATION, options: { ref: Role.slug } },
                      slackWebhookUrl: { type: FieldTypes.TEXT },
                    },
                    conditionalFields: {
                      dependsOn: "$.channel",
                      defaultMapping: SubscriptionChannels.EMAIL,
                      mappings: {
                        [SubscriptionChannels.EMAIL]: ["email"],
                        [SubscriptionChannels.ACCOUNT]: ["account", "accountField"],
                        [SubscriptionChannels.ROLE]: ["role"],
                        [SubscriptionChannels.SLACK]: ["slackWebhookUrl"],
                      },
                    },
                    validators: [
                      { type: ValidatorTypes.REQUIRED, options: { field: "email" } },
                      { type: ValidatorTypes.REGEX, options: { pattern: Patterns.EMAIL, field: "email" } },
                      { type: ValidatorTypes.REQUIRED, options: { field: "role" } },
                      { type: ValidatorTypes.REQUIRED, options: { field: "slackWebhookUrl" } },
                      { type: ValidatorTypes.REGEX, options: { pattern: Patterns.URL, field: "slackWebhookUrl" } },
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
