import {
  FieldTypes,
  FieldDefinitionOptions,
  DefaultFieldDefinitionOptions,
  DefaultFieldTextDefinition,
  DefaultFieldBooleanDefinition,
  DefaultFieldNumberDefinition,
  DefaultFieldDateDefinition,
  DefaultFieldJSONDefinition,
  DefaultFieldRelationDefinition,
  DefaultFieldIdDefinition,
} from "@graphand/core";

declare module "@graphand/core" {
  export class Model {
    static subscribe: (cb: (data: (object | string)[]) => void) => () => void;
    subscribe: (callback: (previousDoc) => void) => () => void;
  }

  export type FieldIdDefinition<
    D extends FieldDefinitionOptions<FieldTypes.ID> = DefaultFieldDefinitionOptions<FieldTypes.ID>
  > = DefaultFieldIdDefinition<D>;

  export type FieldTextDefinition<
    D extends FieldDefinitionOptions<FieldTypes.TEXT> = DefaultFieldDefinitionOptions<FieldTypes.TEXT>
  > = DefaultFieldTextDefinition<D>;

  export type FieldBooleanDefinition<
    D extends FieldDefinitionOptions<FieldTypes.BOOLEAN> = DefaultFieldDefinitionOptions<FieldTypes.BOOLEAN>
  > = DefaultFieldBooleanDefinition<D>;

  export type FieldNumberDefinition<
    D extends FieldDefinitionOptions<FieldTypes.NUMBER> = DefaultFieldDefinitionOptions<FieldTypes.NUMBER>
  > = DefaultFieldNumberDefinition<D>;

  export type FieldDateDefinition<
    D extends FieldDefinitionOptions<FieldTypes.DATE> = DefaultFieldDefinitionOptions<FieldTypes.DATE>
  > = DefaultFieldDateDefinition<D>;

  export type FieldJSONDefinition<
    D extends FieldDefinitionOptions<FieldTypes.JSON> = DefaultFieldDefinitionOptions<FieldTypes.JSON>
  > = DefaultFieldJSONDefinition<D>;

  export type FieldRelationDefinition<
    D extends FieldDefinitionOptions<FieldTypes.RELATION> = DefaultFieldDefinitionOptions<FieldTypes.RELATION>
  > = DefaultFieldRelationDefinition<D>;
}
