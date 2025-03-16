import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Account } from "@/models/account.js";
import { Patterns } from "@/enums/patterns.js";

@modelDecorator()
export class Invitation extends Model {
  static __name = "Invitation";
  static configuration = defineConfiguration({
    slug: "invitations",
    isEnvironmentScoped: true,
    blockMultipleOperations: true,
    loadDatamodel: false,
    fields: {
      firstname: { type: FieldTypes.TEXT },
      lastname: { type: FieldTypes.TEXT },
      email: { type: FieldTypes.TEXT },
      account: { type: FieldTypes.RELATION, options: { ref: Account.configuration.slug } },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "firstname" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "lastname" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "email" } },
      { type: ValidatorTypes.REQUIRED, options: { field: "account" } },
      { type: ValidatorTypes.REGEX, options: { field: "email", pattern: Patterns.EMAIL } },
    ],
  });
}
