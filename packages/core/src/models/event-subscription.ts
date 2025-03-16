import { FieldTypes } from "@/enums/field-types.js";
import { SubscriptionChannels } from "@/enums/subscription-channels.js";
import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { Account } from "./account.js";
import { Role } from "./role.js";
import { ValidatorTypes } from "../enums/validator-types.js";
import { Patterns } from "../enums/patterns.js";

@modelDecorator()
export class EventSubscription extends Model {
  static __name = "EventSubscription";
  static configuration = defineConfiguration({
    slug: "eventSubscriptions",
    loadDatamodel: false,
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      enabled: { type: FieldTypes.BOOLEAN, options: { default: true } },
      filter: { type: FieldTypes.OBJECT }, // Filter to limit the subscription to specific events
      channels: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.OBJECT,
            options: {
              strict: true,
              fields: {
                channel: {
                  type: FieldTypes.ENUM,
                  options: { enum: Object.values(SubscriptionChannels) },
                },
                options: {
                  type: FieldTypes.OBJECT,
                  options: {
                    strict: true,
                    fields: {
                      email: { type: FieldTypes.TEXT },
                      account: { type: FieldTypes.RELATION, options: { ref: Account.configuration.slug } },
                      accountField: { type: FieldTypes.TEXT },
                      role: { type: FieldTypes.RELATION, options: { ref: Role.configuration.slug } },
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
  });
}
