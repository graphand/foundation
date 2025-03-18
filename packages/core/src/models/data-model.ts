import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyDefinition } from "@/types/index.js";
import { Function } from "./function.js";
import { defineModelConf } from "@/lib/utils.js";

const functionRelationProperty = {
  type: PropertyTypes.ARRAY,
  items: {
    type: PropertyTypes.OBJECT,
    strict: true,
    properties: {
      function: {
        type: PropertyTypes.RELATION,
        ref: Function.configuration.slug,
      },
      runInJob: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      handleErrors: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
    },
  },
} as const satisfies PropertyDefinition;

@modelDecorator()
export class DataModel extends Model {
  static __name = "DataModel";
  static configuration = defineModelConf({
    slug: "datamodels",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      name: { type: PropertyTypes.STRING },
      slug: { type: PropertyTypes.STRING },
      properties: {
        type: PropertyTypes.OBJECT,
        additionalProperties: {
          type: PropertyTypes.OBJECT,
          properties: {
            type: { type: PropertyTypes.STRING, enum: Object.values(PropertyTypes) },
            default: { type: PropertyTypes.DEFAULT },
            items: { type: PropertyTypes.OBJECT },
            validators: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.OBJECT } },
            distinct: { type: PropertyTypes.BOOLEAN },
            enum: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
            strict: { type: PropertyTypes.BOOLEAN },
            ref: { type: PropertyTypes.STRING },
            additionalProperties: { type: PropertyTypes.OBJECT },
            conditionalProperties: { type: PropertyTypes.OBJECT },
            properties: { type: PropertyTypes.OBJECT },
            required: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
            // options: {
            //   type: PropertyTypes.OBJECT,
            //   strict: true,
            //   properties: {
            //     default: { type: PropertyTypes.DEFAULT },
            //     items: { type: PropertyTypes.OBJECT },
            //     validators: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.OBJECT } },
            //     distinct: { type: PropertyTypes.BOOLEAN },
            //     enum: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
            //     strict: { type: PropertyTypes.BOOLEAN },
            //     ref: { type: PropertyTypes.STRING },
            //     additionalProperties: { type: PropertyTypes.OBJECT },
            //     conditionalProperties: { type: PropertyTypes.OBJECT },
            //     properties: { type: PropertyTypes.OBJECT },
            //     required: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
            //   },
            //   conditionalProperties: {
            //     dependsOn: "$.type",
            //     mappings: {
            //       [PropertyTypes.ARRAY]: ["items", "validators", "distinct"],
            //       [PropertyTypes.STRING]: ["default"],
            //       [PropertyTypes.RELATION]: ["ref"],
            //       [PropertyTypes.NUMBER]: ["default"],
            //       [PropertyTypes.INTEGER]: ["default"],
            //       [PropertyTypes.STRING]: ["default", "enum"],
            //       [PropertyTypes.OBJECT]: [
            //         "default",
            //         "additionalProperties",
            //         "conditionalProperties",
            //         "properties",
            //         "strict",
            //         "validators",
            //       ],
            //       [PropertyTypes.BOOLEAN]: ["default"],
            //     },
            //   },
            // },
          },
          required: ["type"],
        },
      },
      validators: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
          strict: true,
          properties: {
            type: { type: PropertyTypes.STRING, enum: Object.values(ValidatorTypes) },
            property: { type: PropertyTypes.STRING },
            min: { type: PropertyTypes.NUMBER },
            max: { type: PropertyTypes.NUMBER },
            pattern: { type: PropertyTypes.STRING },
            options: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
            // conditionalProperties: {
            //   dependsOn: "$.type",
            //   mappings: {
            //     [ValidatorTypes.REQUIRED]: ["property"],
            //     [ValidatorTypes.UNIQUE]: ["property"],
            //     [ValidatorTypes.BOUNDARIES]: ["property", "min", "max"],
            //     [ValidatorTypes.LENGTH]: ["property", "min", "max"],
            //     [ValidatorTypes.REGEX]: ["property", "pattern", "options"],
            //     [ValidatorTypes.SAMPLE]: ["property"],
            //     [ValidatorTypes.KEY_PROPERTY]: ["property"],
            //     [ValidatorTypes.EXISTS]: ["property"],
            //   },
            // },
          },
          required: ["type"],
        },
      },
      required: {
        type: PropertyTypes.ARRAY,
        items: { type: PropertyTypes.STRING },
      },
      single: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      keyProperty: {
        type: PropertyTypes.STRING,
      },
      hooks: {
        type: PropertyTypes.OBJECT,
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
          { type: ValidatorTypes.LENGTH, property: "before_createOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_createOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "before_createMultiple", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_createMultiple", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "before_updateOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_updateOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "before_updateMultiple", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_updateMultiple", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "before_deleteOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_deleteOne", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "before_deleteMultiple", max: 100 },
          { type: ValidatorTypes.LENGTH, property: "after_deleteMultiple", max: 100 },
        ],
      },
      realtime: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      _doc: { type: PropertyTypes.OBJECT },
    },
    required: ["slug"],
    validators: [{ type: ValidatorTypes.DATAMODEL }],
  });
}
