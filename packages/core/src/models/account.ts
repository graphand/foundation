import { defineConfiguration, Model } from "@/lib/model.js";
import { Role } from "@/models/role.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Patterns } from "@/enums/patterns.js";

@modelDecorator()
export class Account extends Model {
  static __name = "Account";
  static configuration = defineConfiguration({
    slug: "accounts",
    connectable: true,
    loadDatamodel: true,
    realtime: true,
    isEnvironmentScoped: true,
    properties: {
      role: {
        type: PropertyTypes.RELATION,
        options: {
          ref: Role.configuration.slug,
        },
      },
      _email: { type: PropertyTypes.TEXT },
      _lastLoginAt: { type: PropertyTypes.DATE },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { property: "role" } },
      { type: ValidatorTypes.UNIQUE, options: { property: "_email" } },
      { type: ValidatorTypes.REGEX, options: { property: "_email", pattern: Patterns.EMAIL } },
    ],
  });
}
