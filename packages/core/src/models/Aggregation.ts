import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { ModelDefinition } from "@/types/index.ts";

@modelDecorator()
export class Aggregation extends Model {
  static __name = "Aggregation";
  static isEnvironmentScoped = true;
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
            type: FieldTypes.NESTED,
          },
        },
      },
      let: {
        type: FieldTypes.NESTED,
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "source" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "pipeline" } },
    ],
  } satisfies ModelDefinition;
}
