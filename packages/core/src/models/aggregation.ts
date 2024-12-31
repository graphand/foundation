import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Aggregation extends Model {
  static __name = "Aggregation" as const;
  static isEnvironmentScoped = true as const;
  static slug = "aggregations" as const;
  static definition = {
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
  } satisfies ModelDefinition;
}
