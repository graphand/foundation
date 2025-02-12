import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldDefinition, ModelDefinition } from "@/types/index.js";
import { Function } from "./function.js";

const functionRelationField = {
  type: FieldTypes.ARRAY,
  options: {
    items: {
      type: FieldTypes.OBJECT,
      options: {
        strict: true,
        fields: {
          function: {
            type: FieldTypes.RELATION,
            options: {
              ref: Function.slug,
            },
          },
          runInJob: {
            type: FieldTypes.BOOLEAN,
            options: {
              default: false,
            },
          },
          handleErrors: {
            type: FieldTypes.BOOLEAN,
            options: {
              default: false,
            },
          },
        },
      },
    },
  },
} as const satisfies FieldDefinition;

@modelDecorator()
export class DataModel extends Model {
  static __name = "DataModel";
  static isEnvironmentScoped = true as const;
  static realtime = true as const;
  static slug = "datamodels" as const;
  static definition = {
    keyField: "slug",
    fields: {
      name: { type: FieldTypes.TEXT },
      slug: { type: FieldTypes.TEXT },
      definition: {
        type: FieldTypes.OBJECT,
        options: {
          fields: {
            fields: {
              type: FieldTypes.OBJECT,
              options: {
                defaultField: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: Object.values(FieldTypes),
                        },
                      },
                      options: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            default: { type: FieldTypes.DEFAULT },
                            items: { type: FieldTypes.OBJECT },
                            validators: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.OBJECT } } },
                            distinct: { type: FieldTypes.BOOLEAN },
                            enum: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.TEXT } } },
                            strict: { type: FieldTypes.BOOLEAN },
                            ref: { type: FieldTypes.TEXT },
                            defaultField: { type: FieldTypes.OBJECT },
                            conditionalFields: { type: FieldTypes.OBJECT },
                            fields: { type: FieldTypes.OBJECT },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              [FieldTypes.ARRAY]: ["items", "validators", "distinct"],
                              [FieldTypes.TEXT]: ["default"],
                              [FieldTypes.RELATION]: ["ref"],
                              [FieldTypes.NUMBER]: ["default"],
                              [FieldTypes.INTEGER]: ["default"],
                              [FieldTypes.ENUM]: ["default", "enum"],
                              [FieldTypes.OBJECT]: [
                                "default",
                                "defaultField",
                                "conditionalFields",
                                "fields",
                                "strict",
                                "validators",
                              ],
                              [FieldTypes.BOOLEAN]: ["default"],
                            },
                          },
                        },
                      },
                    },
                    validators: [
                      {
                        type: ValidatorTypes.REQUIRED,
                        options: {
                          field: "type",
                        },
                      },
                    ],
                  },
                },
              },
            },
            validators: {
              type: FieldTypes.ARRAY,
              options: {
                items: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.ENUM,
                        options: {
                          enum: Object.values(ValidatorTypes),
                        },
                      },
                      options: {
                        type: FieldTypes.OBJECT,
                        options: {
                          strict: true,
                          fields: {
                            field: { type: FieldTypes.TEXT },
                            min: { type: FieldTypes.NUMBER },
                            max: { type: FieldTypes.NUMBER },
                            pattern: { type: FieldTypes.TEXT },
                            options: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.TEXT } } },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              [ValidatorTypes.REQUIRED]: ["field"],
                              [ValidatorTypes.UNIQUE]: ["field"],
                              [ValidatorTypes.BOUNDARIES]: ["field", "min", "max"],
                              [ValidatorTypes.LENGTH]: ["field", "min", "max"],
                              [ValidatorTypes.REGEX]: ["field", "pattern", "options"],
                              [ValidatorTypes.SAMPLE]: ["field"],
                              [ValidatorTypes.KEY_FIELD]: ["field"],
                              [ValidatorTypes.EXISTS]: ["field"],
                            },
                          },
                        },
                      },
                    },
                    validators: [
                      {
                        type: ValidatorTypes.REQUIRED,
                        options: {
                          field: "type",
                        },
                      },
                    ],
                  },
                },
              },
            },
            single: {
              type: FieldTypes.BOOLEAN,
              options: {
                default: false,
              },
            },
            keyField: {
              type: FieldTypes.TEXT,
            },
          },
        },
        _ts: undefined as unknown as ModelDefinition,
      },
      hooks: {
        type: FieldTypes.OBJECT,
        options: {
          strict: true,
          fields: {
            before_createOne: functionRelationField,
            after_createOne: functionRelationField,
            complete_createOne: functionRelationField,
            before_createMultiple: functionRelationField,
            after_createMultiple: functionRelationField,
            complete_createMultiple: functionRelationField,
            before_updateOne: functionRelationField,
            after_updateOne: functionRelationField,
            complete_updateOne: functionRelationField,
            before_updateMultiple: functionRelationField,
            after_updateMultiple: functionRelationField,
            complete_updateMultiple: functionRelationField,
            before_deleteOne: functionRelationField,
            after_deleteOne: functionRelationField,
            complete_deleteOne: functionRelationField,
            before_deleteMultiple: functionRelationField,
            after_deleteMultiple: functionRelationField,
            complete_deleteMultiple: functionRelationField,
          },
          validators: [
            { type: ValidatorTypes.LENGTH, options: { field: "before_createOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_createOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "before_createMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_createMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "before_updateOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_updateOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "before_updateMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_updateMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "before_deleteOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_deleteOne", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "before_deleteMultiple", max: 100 } },
            { type: ValidatorTypes.LENGTH, options: { field: "after_deleteMultiple", max: 100 } },
          ],
        },
      },
      realtime: {
        type: FieldTypes.BOOLEAN,
        options: {
          default: false,
        },
      },
      _doc: { type: FieldTypes.OBJECT },
    },
    validators: [{ type: ValidatorTypes.DATAMODEL_SLUG }, { type: ValidatorTypes.DATAMODEL_DEFINITION }],
  } as const satisfies ModelDefinition;
}
