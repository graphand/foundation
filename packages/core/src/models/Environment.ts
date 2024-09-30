import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Job } from "@/models/Job.ts";
import { MergeRequest } from "@/models/MergeRequest.ts";
import { ModelDefinition } from "@/types/index.ts";

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
