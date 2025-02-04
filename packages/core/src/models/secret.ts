import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Secret extends Model {
  static __name = "Secret" as const;
  static slug = "secrets" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      value: { type: FieldTypes.TEXT },
    },
    validators: [{ type: ValidatorTypes.REQUIRED, options: { field: "value" } }],
  } as const satisfies ModelDefinition;
}
