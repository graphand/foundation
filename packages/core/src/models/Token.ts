import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Role } from "@/models/Role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Token extends Model {
  static __name = "Token";
  static slug = "tokens" as const;
  static isEnvironmentScoped = true;
  static definition = {
    keyField: "name",
    fields: {
      name: { type: FieldTypes.TEXT },
      expiresAt: { type: FieldTypes.DATE },
      neverExpires: { type: FieldTypes.BOOLEAN, options: { default: false } }, // If true, the token never expires
      lifetime: { type: FieldTypes.NUMBER }, // By default, the token lifetime is the accessTokenLifetime in system settings. In seconds
      maxGen: { type: FieldTypes.NUMBER },
      role: {
        type: FieldTypes.RELATION,
        options: {
          ref: Role.slug,
        },
      },
      _generation: {
        type: FieldTypes.NUMBER,
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
  } satisfies ModelDefinition;
}
