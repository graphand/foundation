export class RequestHelper {
  #req: Request;

  constructor(req: Request) {
    this.#req = req;
  }

  get req() {
    return this.#req;
  }

  get url() {
    return new URL(this.#req.url);
  }

  getHeaders(): Record<string, string> {
    return Object.fromEntries(this.#req.headers.entries());
  }

  getHeader(_key: string, _type: "string", _fallback?: string): string;
  getHeader(_key: string, _type: "number", _fallback?: number): number;
  getHeader(_key: string, _type: "boolean", _fallback?: boolean): boolean;
  getHeader(_key: string, _type?: never, _fallback?: string): string;
  getHeader<T extends "string" | "number" | "boolean">(
    key: string,
    type?: T,
    fallback?: string | number | boolean,
  ): string | number | boolean | null {
    const val = this.req.headers.get(key) ?? fallback;

    if (val === null) {
      return null;
    }

    type ??= "string" as T;

    if (type === "boolean") {
      return Boolean(!["false", "0"].includes(String(val)));
    }

    if (type === "number") {
      return Number(val) || 0;
    }

    return String(val);
  }
}
