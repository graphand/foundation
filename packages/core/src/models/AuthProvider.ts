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
          enum: ["local", "facebook", "google", "github", "apple", "graphand"],
          strict: true,
        },
      },
      options: {
        type: FieldTypes.NESTED,
        options: {
          strict: true,
          dependsOn: "$.type",
          default: {},
          fields: {
            [AuthProviders.LOCAL]: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  confirmEmail: { type: FieldTypes.BOOLEAN, options: { default: false } },
                  confirmTokenLifetime: { type: FieldTypes.NUMBER, options: { default: 3600 } },
                  resetTokenLifetime: { type: FieldTypes.NUMBER, options: { default: 3600 } },
                },
              },
            },
            [AuthProviders.FACEBOOK]: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  clientId: { type: FieldTypes.TEXT },
                  clientSecret: { type: FieldTypes.TEXT },
                  fieldsMap: {
                    type: FieldTypes.NESTED,
                    options: { defaultField: { type: FieldTypes.TEXT } },
                  },
                },
                validators: [
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientSecret" } },
                ],
              },
            },
            [AuthProviders.GRAPHAND]: {
              type: FieldTypes.NESTED,
              options: {
                default: {},
                fields: {
                  autoRegister: { type: FieldTypes.BOOLEAN, options: { default: true } },
                },
              },
            },
            [AuthProviders.GOOGLE]: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  clientId: { type: FieldTypes.TEXT },
                  clientSecret: { type: FieldTypes.TEXT },
                  fieldsMap: {
                    type: FieldTypes.NESTED,
                    options: { defaultField: { type: FieldTypes.TEXT } },
                  },
                },
                validators: [
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientSecret" } },
                ],
              },
            },
            [AuthProviders.GITHUB]: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  clientId: { type: FieldTypes.TEXT },
                  clientSecret: { type: FieldTypes.TEXT },
                  fieldsMap: {
                    type: FieldTypes.NESTED,
                    options: { defaultField: { type: FieldTypes.TEXT } },
                  },
                },
                validators: [
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientSecret" } },
                ],
              },
            },
            [AuthProviders.APPLE]: {
              type: FieldTypes.NESTED,
              options: {
                fields: {
                  clientId: { type: FieldTypes.TEXT },
                  teamId: { type: FieldTypes.TEXT },
                  keyId: { type: FieldTypes.TEXT },
                  privateKey: { type: FieldTypes.TEXT },
                  fieldsMap: {
                    type: FieldTypes.NESTED,
                    options: { defaultField: { type: FieldTypes.TEXT } },
                  },
                },
                validators: [
                  { type: ValidatorTypes.REQUIRED, options: { field: "clientId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "teamId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "keyId" } },
                  { type: ValidatorTypes.REQUIRED, options: { field: "privateKey" } },
                ],
              },
            },
          },
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
