import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Job } from "./Job.js";
import { Role } from "./Role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Function extends Model {
  static __name = "Function";
  static isEnvironmentScoped = true;
  static allowMultipleOperations = false;
  static slug = "functions" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      labels: {
        type: FieldTypes.NESTED,
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
        type: FieldTypes.TEXT,
        options: {
          enum: ["deno"],
          strict: true,
        },
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
      _checksum: { type: FieldTypes.TEXT },
      _size: { type: FieldTypes.NUMBER },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        options: { field: "name" },
      },
    ],
  } satisfies ModelDefinition;
}
