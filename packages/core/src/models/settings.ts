import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Settings extends Model {
  static __name = "Settings";
  static configuration = defineModelConf({
    slug: "settings",
    noBulk: true,
    loadDatamodel: false,
    keyProperty: "key",
    properties: {
      key: { type: PropertyTypes.STRING },
      data: {
        type: PropertyTypes.OBJECT,
        default: {},
        properties: {},
        conditionalProperties: { dependsOn: "$.key", mappings: {} },
      },
    },
  });
}
