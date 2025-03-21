import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { PropertiesRestriction, Rule } from "@/types/index.js";
import { RuleActions } from "@/enums/rule-actions.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Patterns } from "@/enums/patterns.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Role extends Model {
  static __name = "Role";
  static configuration = defineModelConf({
    slug: "roles",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.STRING },
      _admin: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      inherits: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.RELATION,
          ref: "roles",
        },
      },
      rules: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
          strict: true,
          properties: {
            ref: {
              type: PropertyTypes.STRING,
            },
            actions: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
                enum: Object.values(RuleActions),
              },
            },
            filter: {
              type: PropertyTypes.OBJECT,
            },
            prohibition: {
              type: PropertyTypes.BOOLEAN,
            },
          },
        },
      },
      propertiesRestrictions: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.OBJECT,
          strict: true,
          properties: {
            ref: {
              type: PropertyTypes.STRING,
            },
            actions: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
                enum: Object.values(RuleActions),
              },
            },
            filter: {
              type: PropertyTypes.OBJECT,
            },
            properties: {
              type: PropertyTypes.ARRAY,
              items: {
                type: PropertyTypes.STRING,
              },
            },
            inverseProperties: {
              type: PropertyTypes.BOOLEAN,
              default: false,
            },
          },
        },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REGEX,
        property: "slug",
        pattern: Patterns.SLUG,
      },
    ],
  });

  async getRulesInherited(): Promise<Array<Rule>> {
    const i = this.asInstance<Role, typeof Role>();
    let rules = i.rules || [];

    const inheritedRoles = await i.inherits;

    if (inheritedRoles?.length) {
      const rolesRules = await Promise.all(inheritedRoles.map(role => role.getRulesInherited()));

      rules = [...rules, ...rolesRules.flat()];
    }

    return rules;
  }

  async getPropertiesRestrictionsInherited(): Promise<Array<PropertiesRestriction>> {
    const i = this.asInstance<Role, typeof Role>();
    let propertiesRestrictions = i.propertiesRestrictions || [];

    const inheritedRoles = await i.inherits;

    if (inheritedRoles?.length) {
      const rolesPropertiesRestrictions = await Promise.all(
        inheritedRoles.map(role => role.getPropertiesRestrictionsInherited()),
      );

      propertiesRestrictions = [...propertiesRestrictions, ...rolesPropertiesRestrictions.flat()];
    }

    return propertiesRestrictions;
  }
}
