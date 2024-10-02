import { ValidatorTypes } from "@/enums/validator-types.js";
import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Job } from "./Job.js";
import { Key } from "./Key.js";
import { Role } from "./Role.js";

@modelDecorator()
export class Function extends Model {
  static __name = "Function";
  static allowMultipleOperations = false;
  static slug = "functions" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      code: { type: FieldTypes.TEXT }, // base64 encoded function code
      keys: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.RELATION,
            options: {
              ref: Key.slug,
            },
          },
        },
      },
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
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        options: {
          field: "code",
        },
      },
    ],
  } satisfies ModelDefinition;
}
