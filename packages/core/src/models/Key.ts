import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { ModelDefinition } from "@/types/index.ts";

@modelDecorator()
export class Key extends Model {
  static __name = "Key";
  static slug = "keys" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      value: { type: FieldTypes.TEXT },
    },
    validators: [{ type: ValidatorTypes.REQUIRED, options: { field: "value" } }],
  } satisfies ModelDefinition;
}
