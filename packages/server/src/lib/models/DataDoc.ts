import { PropertyTypes, Model, modelDecorator, defineModelConf } from "@graphand/core";

// This model is used to store documents (data) of single datamodels
// Every instance of this model contains a _slug property which is the slug of the datamodel concerned
@modelDecorator()
export class DataDoc extends Model {
  static configuration = defineModelConf({
    slug: "_docs",
    isEnvironmentScoped: true,
    restricted: true,
    loadDatamodel: false,
    properties: {
      _slug: {
        type: PropertyTypes.STRING,
      },
    },
  });

  static modelSlug: string; // The slug of the single datamodel concerned
}
