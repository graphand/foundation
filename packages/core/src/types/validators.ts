import { ValidatorTypes } from "@/enums/validator-types.js";

export type ValidatorOptionsMap = {
  [ValidatorTypes.REQUIRED]: { property: string };
  [ValidatorTypes.UNIQUE]: { property: string };
  [ValidatorTypes.BOUNDARIES]: { property: string; min?: number; max?: number };
  [ValidatorTypes.LENGTH]: { property: string; min?: number; max?: number };
  [ValidatorTypes.REGEX]: {
    property: string;
    pattern: string;
    options?: Partial<Array<"i" | "m" | "s" | "u" | "y">>;
  };
  [ValidatorTypes.SAMPLE]: { property: string };
  [ValidatorTypes.KEY_PROPERTY]: { property: string };
  [ValidatorTypes.EXISTS]: { property: string };
  [ValidatorTypes.DATAMODEL]: {};
};

export type ValidatorOptionsMapOmitProperty = {
  [ValidatorTypes.LENGTH]: { min?: number; max?: number };
  [ValidatorTypes.BOUNDARIES]: { min?: number; max?: number };
  [ValidatorTypes.REGEX]: {
    pattern: string;
    options?: Partial<Array<"i" | "m" | "s" | "u" | "y">>;
  };
};

export type ValidatorOptions<T extends ValidatorTypes = keyof ValidatorOptionsMap | ValidatorTypes> =
  T extends keyof ValidatorOptionsMap ? ValidatorOptionsMap[T] : Record<string, never>;

export type ValidatorDefinitionGeneric<T extends ValidatorTypes> = {
  type: T | `${T}` | string;
} & ValidatorOptionsMap[T];

export type ValidatorDefinition = {
  [K in ValidatorTypes]: ValidatorDefinitionGeneric<K>;
}[ValidatorTypes];

export type ValidatorDefinitionOmitProperty<
  T extends ValidatorTypes = keyof ValidatorOptionsMapOmitProperty | ValidatorTypes,
> = {
  type: T;
  options?: T extends keyof ValidatorOptionsMapOmitProperty ? ValidatorOptionsMapOmitProperty[T] : never;
};
