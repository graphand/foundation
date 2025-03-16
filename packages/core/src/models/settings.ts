import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";

@modelDecorator()
export class Settings extends Model {
  static __name = "Settings";
  static configuration = defineConfiguration({
    slug: "settings",
    blockMultipleOperations: true,
    loadDatamodel: false,
    keyField: "key",
    fields: {
      key: { type: FieldTypes.TEXT },
      data: {
        type: FieldTypes.OBJECT,
        options: { default: {}, fields: {}, conditionalFields: { dependsOn: "$.key", mappings: {} } },
      },
    },
  });
}
