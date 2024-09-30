import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ModelDefinition } from "@/types/index.ts";
import { Job } from "./Job.ts";
import { Key } from "./Key.ts";
import { Role } from "./Role.ts";

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
