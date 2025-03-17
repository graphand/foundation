import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";

@modelDecorator()
export class Secret extends Model {
  static __name = "Secret";
  static configuration = defineConfiguration({
    slug: "secrets",
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.TEXT },
      value: { type: PropertyTypes.TEXT },
    },
    required: ["value"],
  });
}
