import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "@/models/job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
import { MergeRequest } from "@/models/merge-request.js";

@modelDecorator()
export class MergeRequestAction extends Model {
  static __name = "MergeRequestAction";
  static configuration = defineConfiguration({
    slug: "mergeRequestActions",
    blockMultipleOperations: true,
    properties: {
      type: {
        type: PropertyTypes.ENUM,
        enum: Object.values(MergeRequestActionTypes),
        default: MergeRequestActionTypes.PATCH,
      },
      data: {
        type: PropertyTypes.OBJECT,
        properties: {
          close: {
            type: PropertyTypes.BOOLEAN,
          },
          comment: {
            type: PropertyTypes.TEXT,
          },
          apply: {
            type: PropertyTypes.OBJECT,
          },
        },
      },
      request: {
        type: PropertyTypes.RELATION,
        ref: MergeRequest.configuration.slug,
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
    },
    validators: [{ type: ValidatorTypes.REQUIRED, property: "request" }],
  });
}
