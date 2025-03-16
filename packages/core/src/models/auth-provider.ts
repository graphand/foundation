import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Role } from "@/models/role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { AuthProviders } from "@/enums/auth-providers.js";

@modelDecorator()
export class AuthProvider extends Model {
  static __name = "AuthProvider";
  static configuration = defineConfiguration({
    slug: "authProviders",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "type",
    properties: {
      type: {
        type: PropertyTypes.ENUM,
        options: {
          enum: Object.values(AuthProviders),
          default: AuthProviders.LOCAL,
        },
      },
      options: {
        type: PropertyTypes.OBJECT,
        options: {
          strict: true,
          default: {},
          conditionalProperties: {
            dependsOn: "$.type",
            mappings: {
              [AuthProviders.GRAPHAND]: ["propertiesMap", "scopes", "autoRegister"],
              [AuthProviders.LOCAL]: [
                "confirmEmail",
                "confirmTokenLifetime",
                "resetTokenLifetime",
                "allowResetPassword",
              ],
              [AuthProviders.FACEBOOK]: ["clientId", "clientSecret", "propertiesMap", "scopes", "autoRegister"],
              [AuthProviders.GOOGLE]: ["clientId", "clientSecret", "propertiesMap", "scopes", "autoRegister"],
              [AuthProviders.GITHUB]: ["clientId", "clientSecret", "propertiesMap", "scopes", "autoRegister"],
              [AuthProviders.APPLE]: [
                "clientId",
                "teamId",
                "keyId",
                "privateKey",
                "propertiesMap",
                "scopes",
                "autoRegister",
              ],
            },
          },
          properties: {
            confirmEmail: { type: PropertyTypes.BOOLEAN, options: { default: false } },
            confirmTokenLifetime: { type: PropertyTypes.INTEGER, options: { default: 3600 } },
            resetTokenLifetime: { type: PropertyTypes.INTEGER, options: { default: 3600 } },
            allowResetPassword: { type: PropertyTypes.BOOLEAN, options: { default: false } },
            propertiesMap: {
              type: PropertyTypes.OBJECT,
              options: { additionalProperties: { type: PropertyTypes.TEXT } },
            },
            scopes: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.TEXT } } },
            autoRegister: { type: PropertyTypes.BOOLEAN, options: { default: true } },
            teamId: { type: PropertyTypes.TEXT },
            clientId: { type: PropertyTypes.TEXT },
            clientSecret: { type: PropertyTypes.TEXT },
            keyId: { type: PropertyTypes.TEXT },
            privateKey: { type: PropertyTypes.TEXT },
            // oauth: {
            //   type: PropertyTypes.OBJECT,
            //   options: {
            //     properties: {
            //       clientId: { type: PropertyTypes.TEXT },
            //       clientSecret: { type: PropertyTypes.TEXT },
            //       propertiesMap: { type: PropertyTypes.OBJECT, options: { additionalProperties: { type: PropertyTypes.TEXT } } },
            //       scopes: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.TEXT } } },
            //     },
            //   },
            // },
          },
          validators: [
            { type: ValidatorTypes.REQUIRED, options: { property: "clientId" } },
            { type: ValidatorTypes.REQUIRED, options: { property: "clientSecret" } },
            { type: ValidatorTypes.REQUIRED, options: { property: "teamId" } },
            { type: ValidatorTypes.REQUIRED, options: { property: "keyId" } },
            { type: ValidatorTypes.REQUIRED, options: { property: "privateKey" } },
          ],
        },
      },
      enabled: { type: PropertyTypes.BOOLEAN, options: { default: true } },
      register: {
        type: PropertyTypes.OBJECT,
        options: {
          properties: {
            enabled: { type: PropertyTypes.BOOLEAN, options: { default: true } },
            role: {
              type: PropertyTypes.RELATION,
              options: {
                ref: Role.configuration.slug,
              },
            },
            authorizedProperties: {
              type: PropertyTypes.ARRAY,
              options: { items: { type: PropertyTypes.TEXT } },
            },
          },
        },
      },
    },
  });
}
