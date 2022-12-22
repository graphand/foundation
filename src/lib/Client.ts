import { Model, Data } from "@graphand/core";
import ClientModelAdapter from "./ClientModelAdapter";
import BehaviorSubject from "./BehaviorSubject";
// @ts-ignore
import https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

type ClientOptions = {
  project: string;
  accessToken?: string;
  refreshToken?: string;
};

class Client {
  __optionsSubject: BehaviorSubject<ClientOptions>;
  __cachedModels = new Map<string, typeof Model>();

  constructor(options: ClientOptions) {
    this.__optionsSubject = new BehaviorSubject(options);
  }

  get options(): ClientOptions {
    return this.__optionsSubject.getValue();
  }

  setOptions(assignOpts: Partial<ClientOptions>) {
    this.__optionsSubject.next({ ...this.options, ...assignOpts });
  }

  fetch(input: RequestInfo | URL, init: RequestInit = {}) {
    let url;
    if (typeof input !== "string" || input.includes(`://`)) {
      url = input;
    } else {
      url =
        `https://${this.options.project}.api.graphand.io.local:1337/` + input;
    }

    // @ts-ignore
    init.agent ??= agent;
    init.headers ??= {};
    Object.assign(init.headers, {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: this.options.accessToken
        ? `Bearer ${this.options.accessToken}`
        : undefined,
    });

    return fetch(url, init).then((r) => r.json());
  }

  getModel<T extends typeof Model>(model: T): T {
    if (!this.__cachedModels.get(model.slug)) {
      const client = this;

      const adapter = class extends ClientModelAdapter {
        static __client = client;
      };

      const GModel = model.withAdapter(adapter);

      this.__cachedModels.set(model.slug, GModel);
    }

    return this.__cachedModels.get(model.slug) as T;
  }

  getDataModel(slug: string): typeof Data {
    const Model = class extends Data {
      static __name = `Data<${slug}>`;
      static slug = slug;
    };

    return this.getModel(Model);
  }

  async login(email: string, password: string) {
    const { accessToken, refreshToken } = await this.fetch("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.setOptions({ accessToken, refreshToken });
  }
}

export default Client;
