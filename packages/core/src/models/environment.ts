import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Job } from "@/models/job.js";
import { MergeRequest } from "@/models/merge-request.js";

@modelDecorator()
export class Environment extends Model {
  static __name = "Environment";
  static configuration = defineConfiguration({
    slug: "environments",
    blockMultipleOperations: true,
    loadDatamodel: false,
    keyField: "name",
    fields: {
      name: {
        type: FieldTypes.TEXT,
      },
      base: {
        type: FieldTypes.RELATION,
        options: {
          ref: "environments", // Circular reference
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.configuration.slug,
        },
      },
      _fromRequest: {
        type: FieldTypes.RELATION,
        options: {
          ref: MergeRequest.configuration.slug,
        },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REGEX,
        options: {
          field: "name",
          pattern: "^(?!master$|main$)[a-z0-9]+$",
        },
      },
    ],
  });
}
