import { ModelDefinition } from "@/types/index.js";
import { Model } from "@/lib/Model.js";
import { Role } from "@/models/Role.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Patterns } from "@/enums/patterns.js";

@modelDecorator()
export class Account extends Model {
  static __name = "Account";
  static connectable = true;
  static extensible = true;
  static isEnvironmentScoped = true;
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
  } satisfies ModelDefinition;
}
