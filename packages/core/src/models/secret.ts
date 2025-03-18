import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Secret extends Model {
  static __name = "Secret";
  static configuration = defineModelConf({
    slug: "secrets",
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.STRING },
      value: { type: PropertyTypes.STRING },
    },
    required: ["value"],
  });
}
