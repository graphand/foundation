import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "@/models/job.js";
import { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
import { MergeRequest } from "@/models/merge-request.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class MergeRequestAction extends Model {
  static __name = "MergeRequestAction";
  static configuration = defineModelConf({
    slug: "mergeRequestActions",
    blockMultipleOperations: true,
    properties: {
      type: {
        type: PropertyTypes.STRING,
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
            type: PropertyTypes.STRING,
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
    required: ["request"],
  });
}
