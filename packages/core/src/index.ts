declare global {
  const __INTERNAL_CORE_VERSION__: string;
}

export const __CORE_VERSION__ = JSON.stringify(__INTERNAL_CORE_VERSION__).replaceAll('"', "");

import "@/register-models";

export * from "@/types/index.js";
export * from "@/lib/controllers.js";

export { modelDecorator } from "@/lib/model-decorator.js";
export { Adapter } from "@/lib/adapter.js";
export { CoreError } from "@/lib/core-error.js";
export { Property } from "@/lib/property.js";
export { PropertyArray } from "@/lib/properties/array.js";
export { PropertyBoolean } from "@/lib/properties/boolean.js";
export { PropertyDate } from "@/lib/properties/date.js";
export { PropertyId } from "@/lib/properties/id.js";
export { PropertyIdentity } from "@/lib/properties/identity.js";
export { PropertyObject } from "@/lib/properties/object.js";
export { PropertyNumber } from "@/lib/properties/number.js";
export { PropertyRelation } from "@/lib/properties/relation.js";
export { PropertyText } from "@/lib/properties/text.js";
export { Model } from "@/lib/model.js";
export { ModelList } from "@/lib/model-list.js";
export { PromiseModel } from "@/lib/promise-model.js";
export { PromiseModelList } from "@/lib/promise-model-list.js";
export { ValidationError } from "@/lib/validation-error.js";
export { ValidationPropertyError } from "@/lib/validation-property-error.js";
export { ValidationValidatorError } from "@/lib/validation-validator-error.js";
export { Validator } from "@/lib/validator.js";
export { ValidatorBoundaries } from "@/lib/validators/boundaries.js";
export { ValidatorDatamodel } from "@/lib/validators/datamodel.js";
export { ValidatorKeyProperty } from "@/lib/validators/key-property.js";
export { ValidatorLength } from "@/lib/validators/length.js";
export { ValidatorRegex } from "@/lib/validators/regex.js";
export { ValidatorRequired } from "@/lib/validators/required.js";
export { ValidatorUnique } from "@/lib/validators/unique.js";
export { Account } from "@/models/account.js";
export { Aggregation } from "@/models/aggregation.js";
export { AuthProvider } from "@/models/auth-provider.js";
export { Connector } from "@/models/connector.js";
export { DataModel } from "@/models/data-model.js";
export { Environment } from "@/models/environment.js";
export { Event } from "@/models/event.js";
export { EventSubscription } from "@/models/event-subscription.js";
export { Function } from "@/models/function.js";
export { Invitation } from "@/models/invitation.js";
export { Job } from "@/models/job.js";
export { Media } from "@/models/media.js";
export { MergeRequest } from "@/models/merge-request.js";
export { MergeRequestAction } from "@/models/merge-request-action.js";
export { Role } from "@/models/role.js";
export { Secret } from "@/models/secret.js";
export { Settings } from "@/models/settings.js";
export { Snapshot } from "@/models/snapshot.js";
export { TokenIssuer } from "@/models/token-issuer.js";
export { AuthMethods } from "@/enums/auth-methods.js";
export { AuthProviders } from "@/enums/auth-providers.js";
export { ErrorCodes } from "@/enums/error-codes.js";
export { PropertyTypes } from "@/enums/property-types.js";
export { IdentityTypes } from "@/enums/identity-types.js";
export { JobStatus } from "@/enums/job-status.js";
export { JobTypes } from "@/enums/job-types.js";
export { MergeRequestActionTypes } from "@/enums/merge-request-action-types.js";
export { MergeRequestTypes } from "@/enums/merge-request-types.js";
export { Patterns } from "@/enums/patterns.js";
export { RuleActions } from "@/enums/rule-actions.js";
export { ValidatorTypes } from "@/enums/validator-types.js";
export { EventSources } from "@/enums/event-sources.js";
export { EventSeverities } from "@/enums/event-severities.js";
export { SubscriptionChannels } from "@/enums/subscription-channels.js";
export {
  isObjectId,
  crossProperties,
  definePropertiesObject,
  getArrayItemsPropertiesMap,
  getArrayValidatorsArray,
  getPropertyFromDefinition,
  getPropertiesPathsFromPath,
  getNestedPropertiesMap,
  getNestedValidatorsArray,
  getValidatorFromDefinition,
  validateModel,
  getValidationValues,
  getNestedPropertiesArrayForModel,
  getRelationModelsFromPath,
  createValidationError,
  assignDatamodel,
} from "@/lib/utils.js";
