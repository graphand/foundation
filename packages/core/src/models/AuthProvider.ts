import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { Role } from "@/models/Role.js";
import { ModelDefinition } from "@/types/index.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { AuthProviders } from "@/enums/auth-providers.js";

@modelDecorator()
export class AuthProvider extends Model {
  static __name = "AuthProvider";
  static slug = "authProviders" as const;
  static isEnvironmentScoped = true;
  static definition = {
    keyField: "type",
    fields: {
      type: {
        type: FieldTypes.TEXT,
        options: {
          enum: Object.values(AuthProviders),
          strict: true,
          default: AuthProviders.LOCAL,
        },
      },
      options: {
        type: FieldTypes.NESTED,
        options: {
          strict: true,
          default: {},
          conditionalFields: {
            dependsOn: "$.type",
            mappings: {
              [AuthProviders.LOCAL]: ["confirmEmail", "confirmTokenLifetime", "resetTokenLifetime"],
              [AuthProviders.FACEBOOK]: ["clientId", "clientSecret", "fieldsMap"],
              [AuthProviders.GOOGLE]: ["clientId", "clientSecret", "fieldsMap"],
              [AuthProviders.GITHUB]: ["clientId", "clientSecret", "fieldsMap"],
              [AuthProviders.APPLE]: ["clientId", "teamId", "keyId", "privateKey", "fieldsMap"],
              [AuthProviders.GRAPHAND]: ["autoRegister"],
            },
          },
          fields: {
            confirmEmail: { type: FieldTypes.BOOLEAN, options: { default: false } },
            confirmTokenLifetime: { type: FieldTypes.NUMBER, options: { default: 3600 } },
            resetTokenLifetime: { type: FieldTypes.NUMBER, options: { default: 3600 } },
            clientId: { type: FieldTypes.TEXT },
            clientSecret: { type: FieldTypes.TEXT },
            fieldsMap: { type: FieldTypes.NESTED, options: { defaultField: { type: FieldTypes.TEXT } } },
            autoRegister: { type: FieldTypes.BOOLEAN, options: { default: true } },
            teamId: { type: FieldTypes.TEXT },
            keyId: { type: FieldTypes.TEXT },
            privateKey: { type: FieldTypes.TEXT },
          },
          validators: [
            { type: ValidatorTypes.REQUIRED, options: { field: "clientId" } },
            { type: ValidatorTypes.REQUIRED, options: { field: "clientSecret" } },
            { type: ValidatorTypes.REQUIRED, options: { field: "teamId" } },
            { type: ValidatorTypes.REQUIRED, options: { field: "keyId" } },
            { type: ValidatorTypes.REQUIRED, options: { field: "privateKey" } },
          ],
        },
      },
      enabled: { type: FieldTypes.BOOLEAN, options: { default: true } },
      register: {
        type: FieldTypes.NESTED,
        options: {
          fields: {
            enabled: { type: FieldTypes.BOOLEAN, options: { default: true } },
            role: {
              type: FieldTypes.RELATION,
              options: {
                ref: Role.slug,
              },
            },
            authorizedFields: {
              type: FieldTypes.ARRAY,
              options: { items: { type: FieldTypes.TEXT } },
            },
          },
        },
      },
    },
  } satisfies ModelDefinition;
}
