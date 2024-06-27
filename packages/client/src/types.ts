import Module from "./lib/Module";

// Define a base type for classes with constructors
export type ModuleConstructor<T extends Module = Module> = (new (...args: any[]) => T) & {
  moduleName: string;
};

// Define the ModuleWithConfig type
export type ModuleWithConfig<T extends ModuleConstructor = ModuleConstructor> = [T, ...ConstructorParameters<T>];

export type ClientModules<T extends ModuleConstructor[]> = {
  [K in keyof T]: ModuleWithConfig<T[K]>;
};

// Define the ClientOptions type
export type ClientOptions = {
  endpoint?: string;
  ssl?: boolean;
};

export type SubjectObserver<T> = (value: T, previousValue?: T) => void;
