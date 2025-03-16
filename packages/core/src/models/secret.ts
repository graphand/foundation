import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Secret extends Model {
  static __name = "Secret";
  static configuration = defineConfiguration({
    slug: "secrets",
    loadDatamodel: false,
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      value: { type: FieldTypes.TEXT },
    },
    validators: [{ type: ValidatorTypes.REQUIRED, options: { field: "value" } }],
  });
}
