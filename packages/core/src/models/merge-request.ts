import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "@/models/job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestTypes } from "@/enums/merge-request-types.js";

@modelDecorator()
export class MergeRequest extends Model {
  static __name = "MergeRequest";
  static configuration = defineConfiguration({
    slug: "mergeRequests",
    blockMultipleOperations: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.TEXT },
      type: {
        type: PropertyTypes.ENUM,
        options: {
          enum: Object.values(MergeRequestTypes),
          default: MergeRequestTypes.STATIC,
        },
      },
      options: {
        type: PropertyTypes.OBJECT,
        options: {
          properties: {
            source: {
              type: PropertyTypes.TEXT,
            },
            query: {
              type: PropertyTypes.OBJECT,
            },
            gdx: {
              type: PropertyTypes.OBJECT,
            },
          },
        },
      },
      target: { type: PropertyTypes.TEXT },
      _closed: {
        type: PropertyTypes.BOOLEAN,
        options: {
          default: false,
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
      { type: ValidatorTypes.REQUIRED, options: { property: "options" } },
      { type: ValidatorTypes.REQUIRED, options: { property: "target" } },
    ],
  });
}
