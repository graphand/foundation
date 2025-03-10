import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Job } from "./job.js";
import { Role } from "./role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Function extends Model {
  static __name = "Function";
  static realtime = true as const;
  static isEnvironmentScoped = true as const;
  static allowMultipleOperations = false as const;
  static loadDatamodel = false as const;
  static slug = "functions" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      labels: {
        type: FieldTypes.OBJECT,
        options: {
          defaultField: {
            type: FieldTypes.TEXT,
          },
        },
      },
      exposed: {
        type: FieldTypes.BOOLEAN,
        options: {
          default: false,
        },
      },
      role: {
        type: FieldTypes.RELATION,
        options: {
          ref: Role.slug,
        },
      },
      runtime: {
        type: FieldTypes.ENUM,
        options: {
          enum: ["deno"],
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
      _checksum: { type: FieldTypes.TEXT },
      _size: { type: FieldTypes.INTEGER },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        options: { field: "name" },
      },
    ],
  } as const satisfies ModelDefinition;
}
