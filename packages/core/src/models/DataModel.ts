import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Function } from "./Function.js";

const functionRelationField = {
  type: FieldTypes.ARRAY,
  options: {
    items: {
      type: FieldTypes.NESTED,
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
} as const;

@modelDecorator()
export class DataModel extends Model {
  static __name = "DataModel";
  static isEnvironmentScoped = true;
  static slug = "datamodels" as const;
  static definition = {
    keyField: "slug",
    fields: {
      name: { type: FieldTypes.TEXT },
      slug: { type: FieldTypes.TEXT },
      definition: {
        type: FieldTypes.NESTED,
        options: {
          fields: {
            fields: {
              type: FieldTypes.NESTED,
              options: {
                defaultField: {
                  type: FieldTypes.NESTED,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.TEXT,
                        options: {
                          enum: Object.values(FieldTypes),
                          strict: true,
                        },
                      },
                      options: {
                        type: FieldTypes.NESTED,
                        options: {
                          strict: true,
                          fields: {
                            default: { type: FieldTypes.DEFAULT },
                            items: { type: FieldTypes.NESTED },
                            validators: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.NESTED } } },
                            distinct: { type: FieldTypes.BOOLEAN },
                            enum: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.TEXT } } },
                            strict: { type: FieldTypes.BOOLEAN },
                            ref: { type: FieldTypes.TEXT },
                            defaultField: { type: FieldTypes.NESTED },
                            conditionalFields: { type: FieldTypes.NESTED },
                            fields: { type: FieldTypes.NESTED },
                          },
                          conditionalFields: {
                            dependsOn: "$.type",
                            mappings: {
                              [FieldTypes.ARRAY]: ["items", "validators", "distinct"],
                              [FieldTypes.TEXT]: ["default", "enum", "strict"],
                              [FieldTypes.RELATION]: ["ref"],
                              [FieldTypes.NUMBER]: ["default"],
                              [FieldTypes.NESTED]: [
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
                  type: FieldTypes.NESTED,
                  options: {
                    fields: {
                      type: {
                        type: FieldTypes.TEXT,
                        options: {
                          enum: Object.values(ValidatorTypes),
                          strict: true,
                        },
                      },
                      options: {
                        type: FieldTypes.NESTED,
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
        type: FieldTypes.NESTED,
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
      _doc: { type: FieldTypes.NESTED },
    } as const,
    validators: [{ type: ValidatorTypes.DATAMODEL_SLUG }, { type: ValidatorTypes.DATAMODEL_DEFINITION }],
  } satisfies ModelDefinition;
}
