import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Function } from "./function.js";
import { Job } from "./job.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Connector extends Model {
  static __name = "Connector";
  static configuration = defineModelConf({
    slug: "connectors",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.STRING },
      options: {
        type: PropertyTypes.OBJECT,
        default: {},
      },
      function: {
        type: PropertyTypes.RELATION,
        ref: Function.configuration.slug,
      },
      query: {
        type: PropertyTypes.OBJECT,
        default: {},
        properties: {
          enabled: { type: PropertyTypes.BOOLEAN, default: false },
          cache: { type: PropertyTypes.BOOLEAN, default: false },
        },
      },
      source: { type: PropertyTypes.STRING },
      filter: { type: PropertyTypes.OBJECT },
      retryStrategy: {
        type: PropertyTypes.OBJECT,
        default: {},
        properties: {
          maxRetries: { type: PropertyTypes.INTEGER, default: 3 },
          initialDelay: { type: PropertyTypes.INTEGER, default: 1000 },
          backoffFactor: { type: PropertyTypes.INTEGER, default: 2 },
          strategyType: {
            type: PropertyTypes.STRING,
            enum: ["fixed", "exponential", "exponentialWithJitter"],
            default: "exponential",
          },
        },
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
    },
    required: ["function", "source"],
  });
}
