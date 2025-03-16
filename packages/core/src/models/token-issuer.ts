import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Role } from "@/models/role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class TokenIssuer extends Model {
  static __name = "TokenIssuer";
  static configuration = defineConfiguration({
    slug: "tokenIssuers",
    isEnvironmentScoped: true,
    loadDatamodel: false,
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      expiresAt: { type: FieldTypes.DATE },
      neverExpires: { type: FieldTypes.BOOLEAN, options: { default: false } }, // If true, the token never expires
      lifetime: { type: FieldTypes.INTEGER }, // By default, the token lifetime is the accessTokenLifetime in system settings. In seconds
      maxGen: { type: FieldTypes.INTEGER },
      role: {
        type: FieldTypes.RELATION,
        options: {
          ref: Role.configuration.slug,
        },
      },
      _generation: {
        type: FieldTypes.INTEGER,
        options: {
          default: 0,
        },
      },
    },
    validators: [
      { type: ValidatorTypes.REQUIRED, options: { field: "role" } },
      { type: ValidatorTypes.BOUNDARIES, options: { field: "lifetime", min: 0 } },
      { type: ValidatorTypes.BOUNDARIES, options: { field: "maxGen", min: 0 } },
    ],
  });
}
