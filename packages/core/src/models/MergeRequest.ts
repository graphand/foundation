import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Job } from "@/models/Job.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { MergeRequestTypes } from "@/enums/merge-request-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class MergeRequest extends Model {
  static __name = "MergeRequest";
  static allowMultipleOperations = false;
  static slug = "mergeRequests" as const;
  static definition = {
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      type: {
        type: FieldTypes.ENUM,
        options: {
          enum: Object.values(MergeRequestTypes),
          default: MergeRequestTypes.STATIC,
        },
      },
      options: {
        type: FieldTypes.OBJECT,
        options: {
          fields: {
            source: {
              type: FieldTypes.TEXT,
            },
            query: {
              type: FieldTypes.OBJECT,
            },
            gdx: {
              type: FieldTypes.OBJECT,
            },
          },
        },
      },
      target: { type: FieldTypes.TEXT },
      _closed: {
        type: FieldTypes.BOOLEAN,
        options: {
          default: false,
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
      { type: ValidatorTypes.REQUIRED, options: { field: "options" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "target" } },
    ],
  } satisfies ModelDefinition;
}
