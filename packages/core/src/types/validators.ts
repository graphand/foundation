import { ValidatorTypes } from "@/enums/validator-types.js";

export type ValidatorOptionsMap = {
  [ValidatorTypes.REQUIRED]: { property: Readonly<string> };
  [ValidatorTypes.UNIQUE]: { property: Readonly<string> };
  [ValidatorTypes.BOUNDARIES]: { property: Readonly<string>; min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.LENGTH]: { property: Readonly<string>; min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.REGEX]: {
    property: Readonly<string>;
    pattern: Readonly<string>;
    options?: Readonly<Partial<Array<"i" | "m" | "s" | "u" | "y">>>;
  };
  [ValidatorTypes.SAMPLE]: { property: Readonly<string> };
  [ValidatorTypes.KEY_PROPERTY]: { property: Readonly<string> };
  [ValidatorTypes.EXISTS]: { property: Readonly<string> };
  [ValidatorTypes.DATAMODEL]: never;
};

export type ValidatorOptionsMapOmitProperty = {
  [ValidatorTypes.LENGTH]: { min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.BOUNDARIES]: { min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.REGEX]: {
    pattern: Readonly<string>;
    options?: Readonly<Partial<Array<"i" | "m" | "s" | "u" | "y">>>;
  };
};

export type ValidatorOptions<T extends ValidatorTypes = keyof ValidatorOptionsMap | ValidatorTypes> =
  T extends keyof ValidatorOptionsMap ? ValidatorOptionsMap[T] : Record<string, never>;

export type ValidatorDefinitions = {
  [K in ValidatorTypes]: ValidatorDefinitionGeneric<K>;
}[ValidatorTypes];

export type ValidatorDefinitionGeneric<T extends ValidatorTypes> = {
  type: T | `${T}` | string;
  options?: ValidatorOptionsMap[T] | null;
};

export type ValidatorDefinition = {
  [K in ValidatorTypes]: ValidatorDefinitionGeneric<K>;
}[ValidatorTypes];

export type ValidatorDefinitionOmitProperty<
  T extends ValidatorTypes = keyof ValidatorOptionsMapOmitProperty | ValidatorTypes,
> = {
  type: T;
  options?: T extends keyof ValidatorOptionsMapOmitProperty ? ValidatorOptionsMapOmitProperty[T] : never;
};
