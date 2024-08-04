export type AuthStorage = {
  setItem(_key: string, _value: string): Promise<void> | void;
  getItem(_key: string): Promise<string | null> | string | null;
  removeItem(_key: string): Promise<void> | void;
};
