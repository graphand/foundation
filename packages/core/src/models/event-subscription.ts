import { PropertyTypes } from "@/enums/property-types.js";
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
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.TEXT },
      enabled: { type: PropertyTypes.BOOLEAN, default: true },
      filter: { type: PropertyTypes.OBJECT }, // Filter to limit the subscription to specific events
      channels: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
          strict: true,
          properties: {
            channel: {
              type: PropertyTypes.ENUM,
              enum: Object.values(SubscriptionChannels),
            },
            options: {
              type: PropertyTypes.OBJECT,
              strict: true,
              properties: {
                email: { type: PropertyTypes.TEXT },
                account: { type: PropertyTypes.RELATION, ref: Account.configuration.slug },
                accountProperty: { type: PropertyTypes.TEXT },
                role: { type: PropertyTypes.RELATION, ref: Role.configuration.slug },
                slackWebhookUrl: { type: PropertyTypes.TEXT },
              },
              conditionalProperties: {
                dependsOn: "$.channel",
                defaultMapping: SubscriptionChannels.EMAIL,
                mappings: {
                  [SubscriptionChannels.EMAIL]: ["email"],
                  [SubscriptionChannels.ACCOUNT]: ["account", "accountProperty"],
                  [SubscriptionChannels.ROLE]: ["role"],
                  [SubscriptionChannels.SLACK]: ["slackWebhookUrl"],
                },
              },
              required: ["email", "role", "slackWebhookUrl"],
              validators: [
                { type: ValidatorTypes.REGEX, property: "email", pattern: Patterns.EMAIL },
                { type: ValidatorTypes.REGEX, property: "slackWebhookUrl", pattern: Patterns.URL },
              ],
            },
          },
          required: ["channel", "options"],
        },
      },
    },
    validators: [{ type: ValidatorTypes.BOUNDARIES, property: "channels", min: 1 }],
  });
}
