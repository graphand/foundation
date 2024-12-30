import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Job } from "@/models/job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
import { MergeRequest } from "@/models/merge-request.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class MergeRequestAction extends Model {
  static __name = "MergeRequestAction";
  static allowMultipleOperations = false;
  static slug = "mergeRequestActions" as const;
  static definition = {
    fields: {
      type: {
        type: FieldTypes.ENUM,
        options: {
          enum: Object.values(MergeRequestActionTypes),
          default: MergeRequestActionTypes.PATCH,
        },
      },
      data: {
        type: FieldTypes.OBJECT,
        options: {
          fields: {
            close: {
              type: FieldTypes.BOOLEAN,
            },
            comment: {
              type: FieldTypes.TEXT,
            },
            apply: {
              type: FieldTypes.OBJECT,
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
