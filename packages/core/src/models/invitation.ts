import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Account } from "@/models/account.js";
import { Patterns } from "@/enums/patterns.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Invitation extends Model {
  static __name = "Invitation";
  static configuration = defineModelConf({
    slug: "invitations",
    isEnvironmentScoped: true,
    blockMultipleOperations: true,
    loadDatamodel: false,
    properties: {
      firstname: { type: PropertyTypes.STRING },
      lastname: { type: PropertyTypes.STRING },
      email: { type: PropertyTypes.STRING },
      account: { type: PropertyTypes.RELATION, ref: Account.configuration.slug },
    },
    required: ["firstname", "lastname", "email", "account"],
    validators: [{ type: ValidatorTypes.REGEX, property: "email", pattern: Patterns.EMAIL }],
  });
}
