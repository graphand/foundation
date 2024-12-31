import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Settings extends Model {
  static __name = "Settings" as const;
  static allowMultipleOperations = false as const;
  static slug = "settings" as const;
  static definition = {
    keyField: "key",
    fields: {
      key: { type: FieldTypes.TEXT },
      data: {
        type: FieldTypes.OBJECT,
        options: { default: {}, fields: {}, conditionalFields: { dependsOn: "$.key", mappings: {} } },
      },
    },
  } satisfies ModelDefinition;
}
