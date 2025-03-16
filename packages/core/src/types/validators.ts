import { ValidatorTypes } from "@/enums/validator-types.js";

export type ValidatorOptionsMap = {
  [ValidatorTypes.REQUIRED]: { field: Readonly<string> };
  [ValidatorTypes.UNIQUE]: { field: Readonly<string> };
  [ValidatorTypes.BOUNDARIES]: { field: Readonly<string>; min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.LENGTH]: { field: Readonly<string>; min?: Readonly<number>; max?: Readonly<number> };
  [ValidatorTypes.REGEX]: {
    field: Readonly<string>;
    pattern: Readonly<string>;
    options?: Readonly<Partial<Array<"i" | "m" | "s" | "u" | "y">>>;
  };
  [ValidatorTypes.SAMPLE]: { field: Readonly<string> };
  [ValidatorTypes.KEY_FIELD]: { field: Readonly<string> };
  [ValidatorTypes.EXISTS]: { field: Readonly<string> };
  [ValidatorTypes.DATAMODEL]: never;
};

export type ValidatorOptionsMapOmitField = {
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
  options?: ValidatorOptionsMap[T];
};

export type ValidatorDefinition = {
  [K in ValidatorTypes]: ValidatorDefinitionGeneric<K>;
}[ValidatorTypes];

export type ValidatorDefinitionOmitField<
  T extends ValidatorTypes = keyof ValidatorOptionsMapOmitField | ValidatorTypes,
> = {
  type: T;
  options?: T extends keyof ValidatorOptionsMapOmitField ? ValidatorOptionsMapOmitField[T] : never;
};
