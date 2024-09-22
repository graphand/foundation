import { FieldTypes } from "@/enums/field-types";
import { SubscriptionChannels } from "@/enums/subscription-channels";
import { Model } from "@/lib/Model";
import { modelDecorator } from "@/lib/modelDecorator";
import { ModelDefinition } from "@/types";
import { Account } from "./Account";
import { Role } from "./Role";

@modelDecorator()
export class EventSubscription extends Model {
  static __name = "EventSubscription";
  static slug = "eventSubscriptions" as const;
  static definition = {
    fields: {
      enabled: { type: FieldTypes.BOOLEAN, options: { default: true } },
      channel: { type: FieldTypes.TEXT, options: { enum: Object.values(SubscriptionChannels), strict: true } },
      filter: { type: FieldTypes.NESTED }, // Filter to limit the subscription to specific events
      options: {
        type: FieldTypes.NESTED,
        options: {
          strict: true,
          dependsOn: "channel",
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
          },
        },
      },
    },
  } satisfies ModelDefinition;
}
