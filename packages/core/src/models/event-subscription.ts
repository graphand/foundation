import { PropertyTypes } from "@/enums/property-types.js";
import { SubscriptionChannels } from "@/enums/subscription-channels.js";
import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { defineModelConf } from "@/lib/utils.js";
import { Account } from "./account.js";
import { Role } from "./role.js";
import { ValidatorTypes } from "../enums/validator-types.js";
import { Patterns } from "../enums/patterns.js";

@modelDecorator()
export class EventSubscription extends Model {
  static __name = "EventSubscription";
  static configuration = defineModelConf({
    slug: "eventSubscriptions",
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.STRING },
      enabled: { type: PropertyTypes.BOOLEAN, default: true },
      filter: { type: PropertyTypes.OBJECT }, // Filter to limit the subscription to specific events
      channels: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
          strict: true,
          properties: {
            channel: {
              type: PropertyTypes.STRING,
              enum: Object.values(SubscriptionChannels),
            },
            options: {
              type: PropertyTypes.OBJECT,
              strict: true,
              properties: {
                email: { type: PropertyTypes.STRING },
                account: { type: PropertyTypes.RELATION, ref: Account.configuration.slug },
                accountProperty: { type: PropertyTypes.STRING },
                role: { type: PropertyTypes.RELATION, ref: Role.configuration.slug },
                slackWebhookUrl: { type: PropertyTypes.STRING },
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
              validators: [
                { type: ValidatorTypes.REQUIRED, property: "email" },
                { type: ValidatorTypes.REGEX, property: "email", pattern: Patterns.EMAIL },
                { type: ValidatorTypes.REQUIRED, property: "role" },
                { type: ValidatorTypes.REQUIRED, property: "slackWebhookUrl" },
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
