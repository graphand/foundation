import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Function } from "./Function.js";
import { Job } from "./Job.js";

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
        type: FieldTypes.OBJECT,
        options: { default: {} },
      },
      function: {
        type: FieldTypes.RELATION,
        options: {
          ref: Function.slug,
        },
      },
      query: {
        type: FieldTypes.OBJECT,
        options: {
          default: {},
          fields: {
            enabled: { type: FieldTypes.BOOLEAN, options: { default: false } },
            cache: { type: FieldTypes.BOOLEAN, options: { default: false } },
          },
        },
      },
      source: { type: FieldTypes.TEXT },
      filter: { type: FieldTypes.OBJECT },
      retryStrategy: {
        type: FieldTypes.OBJECT,
        options: {
          default: {},
          fields: {
            maxRetries: { type: FieldTypes.NUMBER, options: { default: 3 } },
            initialDelay: { type: FieldTypes.NUMBER, options: { default: 1000 } },
            backoffFactor: { type: FieldTypes.NUMBER, options: { default: 2 } },
            strategyType: {
              type: FieldTypes.ENUM,
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
