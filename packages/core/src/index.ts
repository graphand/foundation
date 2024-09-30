import "@/modules/validators";
import "@/modules/register-models";

export * from "@/types/index.ts";
export * from "@/lib/controllers.ts";

export { modelDecorator } from "@/lib/modelDecorator.ts";
export { Adapter } from "@/lib/Adapter.ts";
export { CoreError } from "@/lib/CoreError.ts";
export { Field } from "@/lib/Field.ts";
export { FieldArray } from "@/lib/fields/Array.ts";
export { FieldBoolean } from "@/lib/fields/Boolean.ts";
export { FieldDate } from "@/lib/fields/Date.ts";
export { FieldId } from "@/lib/fields/Id.ts";
export { FieldIdentity } from "@/lib/fields/Identity.ts";
export { FieldNested } from "@/lib/fields/Nested.ts";
export { FieldNumber } from "@/lib/fields/Number.ts";
export { FieldRelation } from "@/lib/fields/Relation.ts";
export { FieldText } from "@/lib/fields/Text.ts";
export { Model } from "@/lib/Model.ts";
export { ModelList } from "@/lib/ModelList.ts";
export { PromiseModel } from "@/lib/PromiseModel.ts";
export { PromiseModelList } from "@/lib/PromiseModelList.ts";
export { ValidationError } from "@/lib/ValidationError.ts";
export { ValidationFieldError } from "@/lib/ValidationFieldError.ts";
export { ValidationValidatorError } from "@/lib/ValidationValidatorError.ts";
export { Validator } from "@/lib/Validator.ts";
export { ValidatorBoundaries } from "@/lib/validators/Boundaries.ts";
export { ValidatorDatamodelDefinition } from "@/lib/validators/DatamodelDefinition.ts";
export { ValidatorDatamodelSlug } from "@/lib/validators/DatamodelSlug.ts";
export { ValidatorKeyField } from "@/lib/validators/KeyField.ts";
export { ValidatorLength } from "@/lib/validators/Length.ts";
export { ValidatorRegex } from "@/lib/validators/Regex.ts";
export { ValidatorRequired } from "@/lib/validators/Required.ts";
export { ValidatorUnique } from "@/lib/validators/Unique.ts";
export { Account } from "@/models/Account.ts";
export { Aggregation } from "@/models/Aggregation.ts";
export { AuthProvider } from "@/models/AuthProvider.ts";
export { Connector } from "@/models/Connector.ts";
export { DataModel } from "@/models/DataModel.ts";
export { Environment } from "@/models/Environment.ts";
export { Event } from "@/models/Event.ts";
export { EventSubscription } from "@/models/EventSubscription.ts";
export { Function } from "@/models/Function.ts";
export { Invitation } from "@/models/Invitation.ts";
export { Job } from "@/models/Job.ts";
export { Key } from "@/models/Key.ts";
export { Media } from "@/models/Media.ts";
export { MergeRequest } from "@/models/MergeRequest.ts";
export { MergeRequestEvent } from "@/models/MergeRequestEvent.ts";
export { Role } from "@/models/Role.ts";
export { Settings } from "@/models/Settings.ts";
export { Snapshot } from "@/models/Snapshot.ts";
export { Token } from "@/models/Token.ts";
export { AuthMethods } from "@/enums/auth-methods.ts";
export { AuthProviders } from "@/enums/auth-providers.ts";
export { ErrorCodes } from "@/enums/error-codes.ts";
export { FieldTypes } from "@/enums/field-types.ts";
export { IdentityTypes } from "@/enums/identity-types.ts";
export { JobStatus } from "@/enums/job-status.ts";
export { JobTypes } from "@/enums/job-types.ts";
export { MergeRequestEventTypes } from "@/enums/merge-request-event-types.ts";
export { MergeRequestTypes } from "@/enums/merge-request-types.ts";
export { Patterns } from "@/enums/patterns.ts";
export { RuleActions } from "@/enums/rule-actions.ts";
export { ValidatorTypes } from "@/enums/validator-types.ts";
export { EventSources } from "@/enums/event-sources.ts";
export { EventSeverities } from "@/enums/event-severities.ts";
export { SubscriptionChannels } from "@/enums/subscription-channels.ts";
export {
  isObjectId,
  crossFields,
  defineFieldsProperties,
  getArrayItemsFieldsMap,
  getArrayValidatorsArray,
  getFieldFromDefinition,
  getFieldsPathsFromPath,
  getNestedFieldsMap,
  getNestedValidatorsArray,
  getValidatorFromDefinition,
  validateModel,
  getValidationValues,
  getNestedFieldsArrayForModel,
  getRelationModelsFromPath,
  throwValidationError,
} from "@/lib/utils.ts";
