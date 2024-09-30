import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ModelDefinition } from "@/types/index.ts";

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
        type: FieldTypes.NESTED,
        options: { default: {}, dependsOn: "$.key" },
      },
    },
  } satisfies ModelDefinition;
}
