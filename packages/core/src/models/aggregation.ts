import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Aggregation extends Model {
  static __name = "Aggregation";
  static configuration = defineConfiguration({
    slug: "aggregations",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      source: { type: FieldTypes.TEXT },
      pipeline: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.OBJECT,
          },
        },
      },
      let: {
        type: FieldTypes.OBJECT,
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "source" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "pipeline" } },
    ],
  });
}
