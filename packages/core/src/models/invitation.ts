import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyTypes } from "@/enums/property-types.js";
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
    properties: {
      firstname: { type: PropertyTypes.TEXT },
      lastname: { type: PropertyTypes.TEXT },
      email: { type: PropertyTypes.TEXT },
      account: { type: PropertyTypes.RELATION, ref: Account.configuration.slug },
    },
    required: ["firstname", "lastname", "email", "account"],
    validators: [{ type: ValidatorTypes.REGEX, property: "email", pattern: Patterns.EMAIL }],
  });
}
