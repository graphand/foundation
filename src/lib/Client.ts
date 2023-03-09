import { Model, controllersMap, models } from "@graphand/core";
import ClientModelAdapter from "./ClientModelAdapter";
import BehaviorSubject from "./BehaviorSubject";
import { executeController } from "../utils";
import { Middleware } from "../types";

type ClientOptions = {
  endpoint?: string;
  project?: string;
  environment?: string;
  accessToken?: string;
  refreshToken?: string;
};

const defaultOptions: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  environment: "master",
};

class Client {
  __optionsSubject: BehaviorSubject<ClientOptions>;
  __middlewares: Set<Middleware>;
  __adapter?: typeof ClientModelAdapter;

  constructor(options: ClientOptions) {
    this.__optionsSubject = new BehaviorSubject(options);
  }

  get options(): ClientOptions {
    const opts = Object.fromEntries(
      Object.entries(this.__optionsSubject.getValue()).filter(
        ([_, v]) => v !== undefined
      )
    );

    return Object.assign({}, defaultOptions, opts);
  }

  setOptions(assignOpts: Partial<ClientOptions>) {
    this.__optionsSubject.next({ ...this.options, ...assignOpts });
  }

  getClientAdapter() {
    const client = this;

    this.__adapter ??= class extends ClientModelAdapter {
      static __client = client;
    };

    return this.__adapter;
  }

  getModel<T extends typeof Model = typeof Model>(model: T | T["slug"]): T {
    const adapter = this.getClientAdapter();

    if (typeof model === "string") {
      return Model.getFromSlug(model, adapter);
    }

    return Model.getAdaptedModel(model, adapter);
  }

  middleware(middleware: Middleware) {
    if (!this.hasOwnProperty("__middlewares") || !this.__middlewares) {
      this.__middlewares = new Set();
    }

    this.__middlewares.add(middleware);
  }

  // controllers

  async infos() {
    return await executeController(this, controllersMap.infos);
  }

  async infosProject() {
    return await executeController(this, controllersMap.infosProject);
  }

  async registerUser(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    return await executeController(this, controllersMap.registerUser, {
      body: { email, password },
    });
  }

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

  async genToken(tokenId: string) {
    return await executeController(this, controllersMap.genToken, {
      path: {
        id: tokenId,
      },
    });
  }
}

export default Client;
