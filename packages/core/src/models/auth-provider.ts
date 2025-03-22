import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Role } from "@/models/role.js";
import { AuthProviders } from "@/enums/auth-providers.js";
import { defineModelConf } from "@/lib/utils.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class AuthProvider extends Model {
  static __name = "AuthProvider";
  static configuration = defineModelConf({
    slug: "authProviders",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "type",
    properties: {
      type: {
        type: PropertyTypes.STRING,
        enum: Object.values(AuthProviders),
        default: AuthProviders.LOCAL,
      },
      options: {
        type: PropertyTypes.OBJECT,
        strict: true,
        default: {},
        conditionalProperties: {
          dependsOn: "$.type",
          mappings: {
            [AuthProviders.GRAPHAND]: ["propertiesMap", "scopes", "autoRegister"],
            [AuthProviders.LOCAL]: ["confirmEmail", "confirmTokenLifetime", "resetTokenLifetime", "allowResetPassword"],
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
          confirmEmail: { type: PropertyTypes.BOOLEAN, default: false },
          confirmTokenLifetime: { type: PropertyTypes.INTEGER, default: 3600 },
          resetTokenLifetime: { type: PropertyTypes.INTEGER, default: 3600 },
          allowResetPassword: { type: PropertyTypes.BOOLEAN, default: false },
          propertiesMap: {
            type: PropertyTypes.OBJECT,
            additionalProperties: { type: PropertyTypes.STRING },
          },
          scopes: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
          autoRegister: { type: PropertyTypes.BOOLEAN, default: true },
          teamId: { type: PropertyTypes.STRING },
          clientId: { type: PropertyTypes.STRING },
          clientSecret: { type: PropertyTypes.STRING },
          keyId: { type: PropertyTypes.STRING },
          privateKey: { type: PropertyTypes.STRING },
          // oauth: {
          //   type: PropertyTypes.OBJECT,
          //   options: {
          //     properties: {
          //       clientId: { type: PropertyTypes.STRING },
          //       clientSecret: { type: PropertyTypes.STRING },
          //       propertiesMap: { type: PropertyTypes.OBJECT, options: { additionalProperties: { type: PropertyTypes.STRING } } },
          //       scopes: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.STRING } } },
          //     },
          //   },
          // },
        },
        validators: [
          { type: ValidatorTypes.REQUIRED, property: "clientId" },
          { type: ValidatorTypes.REQUIRED, property: "clientSecret" },
          { type: ValidatorTypes.REQUIRED, property: "teamId" },
          { type: ValidatorTypes.REQUIRED, property: "keyId" },
          { type: ValidatorTypes.REQUIRED, property: "privateKey" },
        ],
      },
      enabled: { type: PropertyTypes.BOOLEAN, default: true },
      register: {
        type: PropertyTypes.OBJECT,
        properties: {
          enabled: { type: PropertyTypes.BOOLEAN, default: true },
          role: {
            type: PropertyTypes.RELATION,
            ref: Role.configuration.slug,
          },
          authorizedProperties: {
            type: PropertyTypes.ARRAY,
            items: { type: PropertyTypes.STRING },
          },
        },
      },
    },
  });
}
