import { Model, Data, controllersMap } from "@graphand/core";
import ClientModelAdapter from "./ClientModelAdapter";
import BehaviorSubject from "./BehaviorSubject";
import { executeController } from "../utils";

type ClientOptions = {
  project?: string;
  environment?: string;
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

  getModel<T extends typeof Model = typeof Model>(model: T | T["slug"]): T {
    let _model: T;
    if (typeof model === "string") {
      _model = Model.getFromSlug(model);
    } else {
      _model = model;
    }

    return this.adaptModel(_model);
  }

  adaptModel<T extends typeof Model>(model: T): T {
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

  // controllers

  async loginAccount(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const { accessToken, refreshToken } = await executeController(
      this,
      controllersMap.loginAccount,
      { body: { email, password } }
    );

    this.setOptions({ accessToken, refreshToken });
  }

  async loginUser(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    const { accessToken, refreshToken } = await executeController(
      this,
      controllersMap.loginUser,
      { body: { email, password } }
    );

    this.setOptions({ accessToken, refreshToken });
  }

  async configSync(config: any, opts: { confirm?: boolean; clean?: boolean }) {
    return await executeController(this, controllersMap.configSync, {
      query: opts,
      body: config,
    });
  }
}

export default Client;
