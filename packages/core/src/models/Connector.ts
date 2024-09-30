import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ModelDefinition } from "@/types/index.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Function } from "./Function.ts";
import { Job } from "./Job.ts";

@modelDecorator()
export class Connector extends Model {
  static __name = "Connector";
  static isEnvironmentScoped = true;
  static allowMultipleOperations = false;
  static slug = "connectors" as const;
  static definition = {
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      options: {
        type: FieldTypes.NESTED,
        options: { default: {} },
      },
      function: {
        type: FieldTypes.RELATION,
        options: {
          ref: Function.slug,
        },
      },
      query: {
        type: FieldTypes.NESTED,
        options: {
          default: {},
          fields: {
            enabled: { type: FieldTypes.BOOLEAN, options: { default: false } },
            cache: { type: FieldTypes.BOOLEAN, options: { default: false } },
          },
        },
      },
      source: { type: FieldTypes.TEXT },
      filter: { type: FieldTypes.NESTED },
      retryStrategy: {
        type: FieldTypes.NESTED,
        options: {
          default: {},
          fields: {
            maxRetries: { type: FieldTypes.NUMBER, options: { default: 3 } },
            initialDelay: { type: FieldTypes.NUMBER, options: { default: 1000 } },
            backoffFactor: { type: FieldTypes.NUMBER, options: { default: 2 } },
            strategyType: {
              type: FieldTypes.TEXT,
              options: {
                enum: ["fixed", "exponential", "exponentialWithJitter"],
                default: "exponential",
              },
            },
          },
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "function" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "source" } },
    ],
  } satisfies ModelDefinition;
}
