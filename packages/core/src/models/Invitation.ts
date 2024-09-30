import { ModelDefinition } from "@/types/index.ts";
import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { Account } from "@/models/Account.ts";
import { Patterns } from "@/enums/patterns.ts";

@modelDecorator()
export class Invitation extends Model {
  static __name = "Invitation";
  static isEnvironmentScoped = true;
  static allowMultipleOperations = false;
  static slug = "invitations" as const;
  static definition = {
    fields: {
      firstname: { type: FieldTypes.TEXT },
      lastname: { type: FieldTypes.TEXT },
      email: { type: FieldTypes.TEXT },
      account: { type: FieldTypes.RELATION, options: { ref: Account.slug } },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "firstname" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "lastname" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "email" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "account" } },
      { type: ValidatorTypes.REGEX, options: { field: "email", pattern: Patterns.EMAIL } },
    ],
  } satisfies ModelDefinition;
}
