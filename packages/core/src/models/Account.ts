import { ModelDefinition } from "@/types/index.ts";
import { Model } from "@/lib/Model.ts";
import { Role } from "@/models/Role.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { FieldTypes } from "@/enums/field-types.ts";

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
    ],
  } satisfies ModelDefinition;
}
