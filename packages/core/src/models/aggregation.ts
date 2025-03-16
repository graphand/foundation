import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Aggregation extends Model {
  static __name = "Aggregation";
  static configuration = defineConfiguration({
    slug: "aggregations",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.TEXT },
      source: { type: PropertyTypes.TEXT },
      pipeline: {
        type: PropertyTypes.ARRAY,
        options: {
          items: {
            type: PropertyTypes.OBJECT,
          },
        },
      },
      let: {
        type: PropertyTypes.OBJECT,
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { property: "source" } },
      { type: ValidatorTypes.REQUIRED, options: { property: "pipeline" } },
    ],
  });
}
