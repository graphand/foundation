# @graphand/core

## 1.8.17

### Patch Changes

- remove MIGRATE_PROJECT job type

## 1.8.16

### Patch Changes

- global improvements & add controllerDeploymentRestart

## 1.8.15

### Patch Changes

- minor improvements

## 1.8.14

### Patch Changes

- minor improvements

## 1.8.13

### Patch Changes

- add ROLE to IdentityTypes enum

## 1.8.12

### Patch Changes

- fixes & improvements

## 1.8.11

### Patch Changes

- rename blockMultipleOperations to noBulk and add noBulk support on datamodel

## 1.8.10

### Patch Changes

- minor change on controller function-bind-tunnel

## 1.8.9

### Patch Changes

- add bindTunnel and unbindTunnel controllers

## 1.8.8

### Patch Changes

- fix InferClientModel type

## 1.8.7

### Patch Changes

- improve types

## 1.8.6

### Patch Changes

- improve types

## 1.8.5

### Patch Changes

- improve types

## 1.8.4

### Patch Changes

- improve types

## 1.8.3

### Patch Changes

- improve types

## 1.8.2

### Patch Changes

- minor fix on assignDatamodel helper

## 1.8.1

### Patch Changes

## 1.8.0

### Minor Changes

- Refactor models with json-schema properties support"

## 1.7.3

### Patch Changes

- minor fixes

## 1.7.2

### Patch Changes

- improve gdx integration

## 1.7.1

### Patch Changes

- minor fixes

## 1.7.0

### Minor Changes

- improve gdx integration, fixes & improvements

## 1.6.2

### Patch Changes

- improve models management

## 1.6.1

### Patch Changes

- enfore models to use modelDecorator

## 1.6.0

### Minor Changes

- exclude core from client bundle

## 1.5.11

### Patch Changes

- improve gdx types

## 1.5.10

### Patch Changes

- change email pattern regex with only lowercase chars

## 1.5.9

### Patch Changes

- clean types & move media model to environment scope

## 1.5.8

### Patch Changes

- improve types

## 1.5.7

### Patch Changes

- fixes & improvements

## 1.5.6

### Patch Changes

- clean code & improve cli

## 1.5.5

### Patch Changes

- add allowResetPassword field on AuthProvider model

## 1.5.4

### Patch Changes

- fix realtime flag in assignDatamodel

## 1.5.3

### Patch Changes

- add realtime flag on Model class

## 1.5.2

### Patch Changes

- clean code

## 1.5.1

### Patch Changes

- clean code

## 1.5.0

### Minor Changes

- Rename Nested field to Object and add Integer + Enum fields

## 1.4.9

### Patch Changes

- remove default value for Function runtime

## 1.4.8

### Patch Changes

- Rename MergeRequestEvent model to MergeRequestAction

## 1.4.7

### Patch Changes

- update controllers

## 1.4.6

### Patch Changes

- Rename Key model to Secret and TokenFactory to TokenIssuer

## 1.4.5

### Patch Changes

- upgrade version

## 1.4.4

### Patch Changes

- add REMOVE_ENVIRONMENT job type

## 1.4.3

### Patch Changes

- improve types

## 1.4.2

### Patch Changes

- improve types

## 1.4.1

### Patch Changes

- improve types

## 1.4.0

### Minor Changes

- Move Function model to environment (isEnvironmentScoped = true)

## 1.3.12

### Patch Changes

- fix AuthProvider model

## 1.3.11

### Patch Changes

- fc9dbce: rename handle auth controller with callback auth & improve Authprovider model

## 1.3.10

### Patch Changes

- improve ValidationError class & add tests

## 1.3.9

### Patch Changes

- add ValidationError.isValidationError method

## 1.3.8

### Patch Changes

- improve ValidationError class

## 1.3.7

### Patch Changes

- rename Token model with TokenIssuer & set isEnvironmentScoped=true
- add validators conditionalFields options support on DataModel

## 1.3.6

### Patch Changes

- add INVALID_VERSION & VERSION_MISMATCH error codes

## 1.3.5

### Patch Changes

- add core version and client version in headers for content negociation

## 1.3.3

### Patch Changes

- clone headers in Client.execute method

## 1.3.2

### Patch Changes

- fix types

## 1.3.1

### Patch Changes

- minor fixes & clean code

## 1.3.0

### Minor Changes

- improve Datamodel model definition adding types for fields options Add conditrionalFields option for the Nested field
  type

## 1.2.6

### Patch Changes

- rebuild core

## 1.2.5

### Patch Changes

- fix Adapter class

## 1.2.4

### Patch Changes

- fix: replace **proto** tag with Object.getPrototypeOf

## 1.2.3

### Patch Changes

- fix Model.reloadModel if datamodel is not found

## 1.2.2

### Patch Changes

- combine init & update function into deploy function job type"

## 1.2.1

### Patch Changes

- clean npm package & fix cli login

## 1.2.0

### Minor Changes

- improve validation with error details
- improve datamodel initialization performance
- clean code

## 1.1.6

### Patch Changes

- improve types

## 1.1.5

### Patch Changes

- add model on ValidationError to improve debug"

## 1.1.4

### Patch Changes

- improve typescript integration for ModelDefinition

## 1.1.3

### Patch Changes

- Clean code & replacing .ts imports with .js extension

## 1.1.2

### Patch Changes

- minor fix

## 1.1.1

### Patch Changes

- Replace jest with vitest
- Refactor code for better esm compatibility

## 1.1.0

### Minor Changes

- move to esm modules

## 1.0.0

### Major Changes

- First release 🎉
