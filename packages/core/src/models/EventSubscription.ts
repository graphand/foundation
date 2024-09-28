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
                  },
                },
              },
            },
          },
        },
      },
    },
  } satisfies ModelDefinition;
}
