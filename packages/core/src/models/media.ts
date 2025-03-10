import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Media extends Model {
  static __name = "Media";
  static slug = "medias" as const;
  static loadDatamodel = true as const;
  static connectable = true as const;
  static realtime = true as const;
  static isEnvironmentScoped = true as const;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      private: { type: FieldTypes.BOOLEAN, options: { default: false } },
      _mimetype: { type: FieldTypes.TEXT },
      _originalname: { type: FieldTypes.TEXT },
      _size: { type: FieldTypes.INTEGER },
    },
  } as const satisfies ModelDefinition;
}
