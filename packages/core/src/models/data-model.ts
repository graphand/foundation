import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyDefinition } from "@/types/index.js";
import { Function } from "./function.js";

const functionRelationProperty = {
  type: PropertyTypes.ARRAY,
  options: {
    items: {
      type: PropertyTypes.OBJECT,
      options: {
        strict: true,
        properties: {
          function: {
            type: PropertyTypes.RELATION,
            options: {
              ref: Function.configuration.slug,
            },
          },
          runInJob: {
            type: PropertyTypes.BOOLEAN,
            options: {
              default: false,
            },
          },
          handleErrors: {
            type: PropertyTypes.BOOLEAN,
            options: {
              default: false,
            },
          },
        },
      },
    },
  },
} as const satisfies PropertyDefinition;

@modelDecorator()
export class DataModel extends Model {
  static __name = "DataModel";
  static configuration = defineConfiguration({
    slug: "datamodels",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      name: { type: PropertyTypes.TEXT },
      slug: { type: PropertyTypes.TEXT, required: true },
      properties: {
        type: PropertyTypes.OBJECT,
        options: {
          additionalProperties: {
            type: PropertyTypes.OBJECT,
            options: {
              properties: {
                type: {
                  type: PropertyTypes.ENUM,
                  options: {
                    enum: Object.values(PropertyTypes),
                  },
                },
                options: {
                  type: PropertyTypes.OBJECT,
                  options: {
                    strict: true,
                    properties: {
                      default: { type: PropertyTypes.DEFAULT },
                      items: { type: PropertyTypes.OBJECT },
                      validators: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.OBJECT } } },
                      distinct: { type: PropertyTypes.BOOLEAN },
                      enum: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.TEXT } } },
                      strict: { type: PropertyTypes.BOOLEAN },
                      ref: { type: PropertyTypes.TEXT },
                      additionalProperties: { type: PropertyTypes.OBJECT },
                      conditionalProperties: { type: PropertyTypes.OBJECT },
                      properties: { type: PropertyTypes.OBJECT },
                    },
                    conditionalProperties: {
                      dependsOn: "$.type",
                      mappings: {
                        [PropertyTypes.ARRAY]: ["items", "validators", "distinct"],
                        [PropertyTypes.TEXT]: ["default"],
                        [PropertyTypes.RELATION]: ["ref"],
                        [PropertyTypes.NUMBER]: ["default"],
                        [PropertyTypes.INTEGER]: ["default"],
                        [PropertyTypes.ENUM]: ["default", "enum"],
                        [PropertyTypes.OBJECT]: [
                          "default",
                          "additionalProperties",
                          "conditionalProperties",
                          "properties",
                          "strict",
                          "validators",
                        ],
                        [PropertyTypes.BOOLEAN]: ["default"],
                      },
                    },
                  },
                },
              },
              validators: [
                {
                  type: ValidatorTypes.REQUIRED,
                  options: {
                    property: "type",
                  },
                },
              ],
            },
          },
        },
      },
      validators: {
        type: PropertyTypes.ARRAY,
        options: {
          items: {
            type: PropertyTypes.OBJECT,
            options: {
              strict: true,
              properties: {
                type: {
                  type: PropertyTypes.ENUM,
                  required: true,
                  options: {
                    enum: Object.values(ValidatorTypes),
                  },
                },
                options: {
                  type: PropertyTypes.OBJECT,
                  required: true,
                  options: {
                    strict: true,
                    properties: {
                      property: { type: PropertyTypes.TEXT, required: true },
                      min: { type: PropertyTypes.NUMBER },
                      max: { type: PropertyTypes.NUMBER },
                      pattern: { type: PropertyTypes.TEXT },
                      options: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.TEXT } } },
                    },
                    conditionalProperties: {
                      dependsOn: "$.type",
                      mappings: {
                        [ValidatorTypes.REQUIRED]: ["property"],
                        [ValidatorTypes.UNIQUE]: ["property"],
                        [ValidatorTypes.BOUNDARIES]: ["property", "min", "max"],
                        [ValidatorTypes.LENGTH]: ["property", "min", "max"],
                        [ValidatorTypes.REGEX]: ["property", "pattern", "options"],
                        [ValidatorTypes.SAMPLE]: ["property"],
                        [ValidatorTypes.KEY_PROPERTY]: ["property"],
                        [ValidatorTypes.EXISTS]: ["property"],
                      },
                    },
                  },
                },
              },
              validators: [
                {
                  type: ValidatorTypes.REQUIRED,
                  options: {
                    property: "type",
                  },
                },
              ],
            },
          },
        },
      },
      single: {
        type: PropertyTypes.BOOLEAN,
        options: {
          default: false,
        },
      },
      keyProperty: {
        type: PropertyTypes.TEXT,
      },
      hooks: {
        type: PropertyTypes.OBJECT,
        options: {
          strict: true,
          properties: {
            before_createOne: functionRelationProperty,
            after_createOne: functionRelationProperty,
            complete_createOne: functionRelationProperty,
            before_createMultiple: functionRelationProperty,
            after_createMultiple: functionRelationProperty,
            complete_createMultiple: functionRelationProperty,
            before_updateOne: functionRelationProperty,
            after_updateOne: functionRelationProperty,
            complete_updateOne: functionRelationProperty,
            before_updateMultiple: functionRelationProperty,
            after_updateMultiple: functionRelationProperty,
            complete_updateMultiple: functionRelationProperty,
            before_deleteOne: functionRelationProperty,
            after_deleteOne: functionRelationProperty,
            complete_deleteOne: functionRelationProperty,
            before_deleteMultiple: functionRelationProperty,
            after_deleteMultiple: functionRelationProperty,
            complete_deleteMultiple: functionRelationProperty,
          },
          validators: [
            { type: ValidatorTypes.LENGTH, options: { property: "before_createOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_createOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "before_createMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_createMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "before_updateOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_updateOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "before_updateMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_updateMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "before_deleteOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_deleteOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "before_deleteMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { property: "after_deleteMultiple", max: 100 } },
          ],
        },
      },
      realtime: {
        type: PropertyTypes.BOOLEAN,
        options: {
          default: false,
        },
      },
      _doc: { type: PropertyTypes.OBJECT },
    },
    validators: [{ type: ValidatorTypes.DATAMODEL }],
  });
}
