import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Job } from "@/models/Job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
import { MergeRequest } from "@/models/MergeRequest.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class MergeRequestAction extends Model {
  static __name = "MergeRequestAction";
  static allowMultipleOperations = false;
  static slug = "mergeRequestActions" as const;
  static definition = {
    fields: {
      type: {
        type: FieldTypes.TEXT,
        options: {
          enum: Object.values(MergeRequestActionTypes),
          strict: true,
          default: MergeRequestActionTypes.PATCH,
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
