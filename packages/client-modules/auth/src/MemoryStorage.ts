import { AuthStorage } from "./types.js";

class MemoryStorage implements AuthStorage {
  private store: Record<string, string> = {};

  setItem(key: string, value: string) {
    this.store[key] = value;
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

export default MemoryStorage;
