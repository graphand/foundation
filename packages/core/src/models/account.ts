import { defineConfiguration, Model } from "@/lib/model.js";
import { Role } from "@/models/role.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldTypes } from "@/enums/field-types.js";
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
    fields: {
      role: {
        type: FieldTypes.RELATION,
        options: {
          ref: Role.configuration.slug,
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
  });
}
