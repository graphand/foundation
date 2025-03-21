import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Role } from "@/models/role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class TokenIssuer extends Model {
  static __name = "TokenIssuer";
  static configuration = defineModelConf({
    slug: "tokenIssuers",
    isEnvironmentScoped: true,
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.STRING },
      expiresAt: { type: PropertyTypes.DATE },
      neverExpires: { type: PropertyTypes.BOOLEAN, default: false }, // If true, the token never expires
      lifetime: { type: PropertyTypes.NUMBER }, // By default, the token lifetime is the accessTokenLifetime in system settings. In seconds
      maxGen: { type: PropertyTypes.INTEGER },
      role: {
        type: PropertyTypes.RELATION,
        ref: Role.configuration.slug,
      },
      _generation: {
        type: PropertyTypes.INTEGER,
        default: 0,
      },
    },
    required: ["role"],
    validators: [
      { type: ValidatorTypes.BOUNDARIES, property: "lifetime", min: 0 },
      { type: ValidatorTypes.BOUNDARIES, property: "maxGen", min: 0 },
    ],
  });
}
