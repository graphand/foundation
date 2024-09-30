import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { Role } from "@/models/Role.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { ModelDefinition } from "@/types/index.ts";

// TODO: rename Token class as TokenGenerator, TokenDefinition

@modelDecorator()
export class Token extends Model {
  static __name = "Token";
  static slug = "tokens" as const;
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
