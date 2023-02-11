import { Model, controllersMap, Account, models } from "@graphand/core";
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

    return this.adaptedModel(_model);
  }

  adaptedModel<T extends typeof Model>(model: T): T {
    let _model = this.__cachedModels.get(model.slug);
    if (!_model) {
      const client = this;

      const adapter = class extends ClientModelAdapter {
        static __client = client;
      };

      _model = model.withAdapter(adapter);

      this.__cachedModels.set(model.slug, _model);
    }

    return _model as T;
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

  async refreshToken() {
    const controller = this.options.project
      ? controllersMap.refreshTokenAccount
      : controllersMap.refreshTokenUser;

    const { accessToken, refreshToken } = await executeController(
      this,
      controller,
      {
        body: {
          accessToken: this.options.accessToken,
          refreshToken: this.options.refreshToken,
        },
      }
    );

    this.setOptions({ accessToken, refreshToken });
  }

  async config(models: string[]) {
    const query = Object.fromEntries(models.map((m) => [m, true]));
    return await executeController(this, controllersMap.config, { query });
  }

  async configSync(config: any, opts: { confirm?: boolean; clean?: boolean }) {
    return await executeController(this, controllersMap.configSync, {
      query: opts,
      body: config,
    });
  }

  async currentUser() {
    const User = this.getModel(models.User);
    const data = await executeController(this, controllersMap.currentUser);
    return new User(data);
  }

  async currentAccount() {
    const Account = this.getModel(models.Account);
    const data = await executeController(this, controllersMap.currentAccount);
    return new Account(data);
  }
}

export default Client;
