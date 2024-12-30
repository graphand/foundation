import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Settings extends Model {
  static __name = "Settings";
  static allowMultipleOperations = false;
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
