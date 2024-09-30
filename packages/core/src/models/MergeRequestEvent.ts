import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { Job } from "@/models/Job.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { MergeRequestTypes } from "@/enums/merge-request-types.ts";
import { MergeRequestEventTypes } from "@/enums/merge-request-event-types.ts";
import { MergeRequest } from "@/models/MergeRequest.ts";
import { ModelDefinition } from "@/types/index.ts";

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
