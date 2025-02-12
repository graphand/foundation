import { ModelDefinition } from "@/types/index.js";
import { Model } from "@/lib/model.js";
import { Role } from "@/models/role.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Patterns } from "@/enums/patterns.js";

@modelDecorator()
export class Account extends Model {
  static __name = "Account";
  static connectable = true as const;
  static extensible = true as const;
  static realtime = true as const;
  static isEnvironmentScoped = true as const;
  static slug = "accounts" as const;
  static definition = {
    fields: {
      role: {
        type: FieldTypes.RELATION,
        options: {
          ref: Role.slug,
        },
      },
      _email: { type: FieldTypes.TEXT },
      _lastLoginAt: { type: FieldTypes.DATE },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "role" } },
      { type: ValidatorTypes.UNIQUE, options: { field: "_email" } },
      { type: ValidatorTypes.REGEX, options: { field: "_email", pattern: Patterns.EMAIL } },
    ],
  } as const satisfies ModelDefinition;
}
