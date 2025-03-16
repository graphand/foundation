import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";

@modelDecorator()
export class Media extends Model {
  static __name = "Media";
  static configuration = defineConfiguration({
    slug: "medias",
    loadDatamodel: true,
    connectable: true,
    realtime: true,
    isEnvironmentScoped: true,
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      private: { type: FieldTypes.BOOLEAN, options: { default: false } },
      _mimetype: { type: FieldTypes.TEXT },
      _originalname: { type: FieldTypes.TEXT },
      _size: { type: FieldTypes.INTEGER },
    },
  });
}
