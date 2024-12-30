import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Media extends Model {
  static __name = "Media";
  static extensible = true;
  static connectable = true;
  static slug = "medias" as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      private: { type: FieldTypes.BOOLEAN, options: { default: false } },
      _mimetype: { type: FieldTypes.TEXT },
      _originalname: { type: FieldTypes.TEXT },
      _size: { type: FieldTypes.INTEGER },
    },
  } satisfies ModelDefinition;
}
