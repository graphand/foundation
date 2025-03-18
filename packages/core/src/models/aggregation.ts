import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Aggregation extends Model {
  static __name = "Aggregation";
  static configuration = defineModelConf({
    slug: "aggregations",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.STRING },
      source: { type: PropertyTypes.STRING },
      pipeline: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
        },
      },
      let: {
        type: PropertyTypes.OBJECT,
      },
    },
    required: ["source", "pipeline"],
  });
}
