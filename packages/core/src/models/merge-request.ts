import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
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
          ref: Job.configuration.slug,
        },
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "options" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "target" } },
    ],
  });
}
