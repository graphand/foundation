import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";

@modelDecorator()
export class Media extends Model {
  static __name = "Media";
  static configuration = defineConfiguration({
    slug: "medias",
    loadDatamodel: true,
    connectable: true,
    realtime: true,
    isEnvironmentScoped: true,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.TEXT },
      private: { type: PropertyTypes.BOOLEAN, default: false },
      _mimetype: { type: PropertyTypes.TEXT },
      _originalname: { type: PropertyTypes.TEXT },
      _size: { type: PropertyTypes.INTEGER },
    },
  });
}
