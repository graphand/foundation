import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Function } from "./function.js";
import { Job } from "./job.js";

@modelDecorator()
export class Connector extends Model {
  static __name = "Connector";
  static configuration = defineConfiguration({
    slug: "connectors",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.TEXT },
      options: {
        type: PropertyTypes.OBJECT,
        options: { default: {} },
      },
      function: {
        type: PropertyTypes.RELATION,
        options: {
          ref: Function.configuration.slug,
        },
      },
      query: {
        type: PropertyTypes.OBJECT,
        options: {
          default: {},
          properties: {
            enabled: { type: PropertyTypes.BOOLEAN, options: { default: false } },
            cache: { type: PropertyTypes.BOOLEAN, options: { default: false } },
          },
        },
      },
      source: { type: PropertyTypes.TEXT },
      filter: { type: PropertyTypes.OBJECT },
      retryStrategy: {
        type: PropertyTypes.OBJECT,
        options: {
          default: {},
          properties: {
            maxRetries: { type: PropertyTypes.INTEGER, options: { default: 3 } },
            initialDelay: { type: PropertyTypes.INTEGER, options: { default: 1000 } },
            backoffFactor: { type: PropertyTypes.INTEGER, options: { default: 2 } },
            strategyType: {
              type: PropertyTypes.ENUM,
              options: {
                enum: ["fixed", "exponential", "exponentialWithJitter"],
                default: "exponential",
              },
            },
          },
        },
      },
      _job: {
        type: PropertyTypes.RELATION,
        options: {
          ref: Job.configuration.slug,
        },
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { property: "function" } },
      { type: ValidatorTypes.REQUIRED, options: { property: "source" } },
    ],
  });
}
