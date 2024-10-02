import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Job } from "@/models/Job.js";
import { MergeRequest } from "@/models/MergeRequest.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Environment extends Model {
  static __name = "Environment";
  static allowMultipleOperations = false;
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
  } satisfies ModelDefinition;
}
