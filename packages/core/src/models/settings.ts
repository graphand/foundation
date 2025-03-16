import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";

@modelDecorator()
export class Settings extends Model {
  static __name = "Settings";
  static configuration = defineConfiguration({
    slug: "settings",
    blockMultipleOperations: true,
    loadDatamodel: false,
    keyProperty: "key",
    properties: {
      key: { type: PropertyTypes.TEXT },
      data: {
        type: PropertyTypes.OBJECT,
        options: { default: {}, properties: {}, conditionalProperties: { dependsOn: "$.key", mappings: {} } },
      },
    },
  });
}
