import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Job } from "@/models/Job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestTypes } from "@/enums/merge-request-types.js";
import { MergeRequestEventTypes } from "@/enums/merge-request-event-types.js";
import { MergeRequest } from "@/models/MergeRequest.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class MergeRequestEvent extends Model {
  static __name = "MergeRequestEvent";
  static allowMultipleOperations = false;
  static slug = "mergeRequestEvents" as const;
  static definition = {
    fields: {
      type: {
        type: FieldTypes.TEXT,
        options: {
          enum: Object.values(MergeRequestEventTypes),
          strict: true,
          default: MergeRequestTypes.STATIC,
        },
      },
      data: {
        type: FieldTypes.NESTED,
        options: {
          fields: {
            close: {
              type: FieldTypes.BOOLEAN,
            },
            comment: {
              type: FieldTypes.TEXT,
            },
            apply: {
              type: FieldTypes.NESTED,
            },
          },
        },
      },
      request: {
        type: FieldTypes.RELATION,
        options: {
          ref: MergeRequest.slug,
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
    },
    validators: [{ type: ValidatorTypes.REQUIRED, options: { field: "request" } }],
  } satisfies ModelDefinition;
}
