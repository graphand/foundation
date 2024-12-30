import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { FieldsRestriction, ModelInstance, Rule } from "@/types/index.js";
import { RuleActions } from "@/enums/rule-actions.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Patterns } from "@/enums/patterns.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Role extends Model {
  static __name = "Role";
  static isEnvironmentScoped = true;
  static slug = "roles" as const;
  static definition = {
    keyField: "slug",
    fields: {
      slug: { type: FieldTypes.TEXT },
      _admin: {
        type: FieldTypes.BOOLEAN,
        options: { default: false },
      },
      inherits: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.RELATION,
            options: {
              ref: Role.slug,
            },
          },
        },
      },
      rules: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.OBJECT,
            options: {
              strict: true,
              fields: {
                ref: {
                  type: FieldTypes.TEXT,
                },
                actions: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.ENUM,
                      options: {
                        enum: Object.values(RuleActions),
                      },
                    },
                  },
                },
                filter: {
                  type: FieldTypes.OBJECT,
                },
                prohibition: {
                  type: FieldTypes.BOOLEAN,
                },
              },
            },
          },
        },
      },
      fieldsRestrictions: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.OBJECT,
            options: {
              strict: true,
              fields: {
                ref: {
                  type: FieldTypes.TEXT,
                },
                actions: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.ENUM,
                      options: {
                        enum: Object.values(RuleActions),
                      },
                    },
                  },
                },
                filter: {
                  type: FieldTypes.OBJECT,
                },
                fields: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: {
                      type: FieldTypes.TEXT,
                    },
                  },
                },
                inverseFields: {
                  type: FieldTypes.BOOLEAN,
                  options: { default: false },
                },
              },
            },
          },
        },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REGEX,
        options: { field: "slug", pattern: Patterns.SLUG },
      },
    ],
  } satisfies ModelDefinition;

  async getRulesInherited(): Promise<Array<Rule>> {
    const i = this as ModelInstance<typeof Role>;
    let rules = i.rules || [];

    const inheritedRoles = await i.inherits;

    if (inheritedRoles?.length) {
      const rolesRules = await Promise.all(inheritedRoles.map(role => role.getRulesInherited()));

      rules = [...rules, ...rolesRules.flat()];
    }

    return rules;
  }

  async getFieldsRestrictionsInherited(): Promise<Array<FieldsRestriction>> {
    const i = this as ModelInstance<typeof Role>;
    let fieldsRestrictions = i.fieldsRestrictions || [];

    const inheritedRoles = await i.inherits;

    if (inheritedRoles?.length) {
      const rolesFieldsRestrictions = await Promise.all(
        inheritedRoles.map(role => role.getFieldsRestrictionsInherited()),
      );

      fieldsRestrictions = [...fieldsRestrictions, ...rolesFieldsRestrictions.flat()];
    }

    return fieldsRestrictions;
  }
}
