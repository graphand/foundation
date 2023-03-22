import { Model, controllersMap, models, ModelCrudEvent } from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import BehaviorSubject from "./BehaviorSubject";
import { executeController, useRealtimeOnSocket } from "./utils";
import { Middleware } from "../types";
import { io, Socket } from "socket.io-client";

const debug = require("debug")("graphand:client");

type ClientOptions = {
  endpoint?: string;
  project?: string;
  environment?: string;
  accessToken?: string;
  refreshToken?: string;
  sockets?: Array<SocketScope>;
};

const defaultOptions: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  environment: "master",
  sockets: ["project"],
};

type SocketScope = "project" | "global";

class Client {
  __optionsSubject: BehaviorSubject<ClientOptions>;
  __middlewares: Set<Middleware>;
  __adapter?: typeof ClientAdapter;
  __socketsMap: Map<SocketScope, Socket>;

  constructor(options: ClientOptions) {
    this.__optionsSubject = new BehaviorSubject(options);

    const optionsSub = this.__optionsSubject.subscribe(() => {
      if (
        this.options.accessToken &&
        this.options.endpoint &&
        this.options.sockets?.length
      ) {
        this.options.sockets.forEach((scope) => {
          this.connectSocket(scope);
        });
      }
    });
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

    this.__adapter ??= class extends ClientAdapter {
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

  connectSocket(scope: SocketScope = "project") {
    this.__socketsMap ??= new Map();

    const scheme = "wss://";
    const endpoint = this.options.endpoint;

    let url;

    if (scope === "project") {
      if (!this.options.project) {
        throw new Error("CLIENT_NO_PROJECT");
      }

      url = scheme + this.options.project + "." + endpoint;
    } else {
      url = scheme + endpoint;
    }

    const socket = io(url, {
      reconnectionDelayMax: 10000,
      auth: {
        token: this.options.accessToken,
      },
    });

    socket.on("connect", () => {
      debug(`Socket connected on scope ${scope} (${url})`);

      const adapter = this.getClientAdapter();
      if (adapter.__modelsMap) {
        useRealtimeOnSocket(socket, Array.from(adapter.__modelsMap.keys()));
      }
    });

    socket.on("realtime:event", (event: ModelCrudEvent) => {
      const model = this.getModel(event.model);
      const adapter = model.__adapter as ClientAdapter;

      adapter.__eventSubject.next(event);
    });

    this.__socketsMap.set(scope, socket);
  }

  close() {
    this.__socketsMap?.forEach((socket) => socket.close());
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
