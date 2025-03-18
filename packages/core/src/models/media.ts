import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Media extends Model {
  static __name = "Media";
  static configuration = defineModelConf({
    slug: "medias",
    loadDatamodel: true,
    connectable: true,
    realtime: true,
    isEnvironmentScoped: true,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.STRING },
      private: { type: PropertyTypes.BOOLEAN, default: false },
      _mimetype: { type: PropertyTypes.STRING },
      _originalname: { type: PropertyTypes.STRING },
      _size: { type: PropertyTypes.INTEGER },
    },
  });
}
