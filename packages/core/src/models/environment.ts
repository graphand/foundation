import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Job } from "@/models/job.js";
import { MergeRequest } from "@/models/merge-request.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Environment extends Model {
  static __name = "Environment" as const;
  static allowMultipleOperations = false as const;
  static slug = "environments" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: {
        type: FieldTypes.TEXT,
      },
      base: {
        type: FieldTypes.RELATION,
        options: {
          ref: Environment.slug,
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
      _fromRequest: {
        type: FieldTypes.RELATION,
        options: {
          ref: MergeRequest.slug,
        },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REGEX,
        options: { field: "name", pattern: "^(?!master$|main$).*$" },
      },
    ],
  } as const satisfies ModelDefinition;
}
