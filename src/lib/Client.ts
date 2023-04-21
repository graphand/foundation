import {
  Model,
  controllersMap,
  models,
  ModelCrudEvent,
  getAdaptedModel,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import BehaviorSubject from "./BehaviorSubject";
import { executeController, useRealtimeOnSocket } from "./utils";
import { Middleware, ClientOptions, SocketScope } from "../types";
import { io, Socket } from "socket.io-client";
import ClientError from "./ClientError";
import ErrorCodes from "../enums/error-codes";

const debug = require("debug")("graphand:client");
const debugSocket = require("debug")("graphand:socket");

const defaultOptions: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  environment: "master",
  sockets: ["project"],
};

class Client {
  __optionsSubject: BehaviorSubject<ClientOptions>;
  __middlewares: Set<Middleware>;
  __adapterClass?: typeof ClientAdapter;
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

    this.__adapterClass ??= class extends ClientAdapter {
      static __client = client;
    };

    return this.__adapterClass;
  }

  declareGlobally() {
    globalThis.__GLOBAL_ADAPTER__ = this.getClientAdapter();
  }

  getModel<T extends typeof Model = typeof Model>(model: T | T["slug"]): T {
    const adapter = this.getClientAdapter();

    if (typeof model === "string") {
      return Model.getFromSlug(model, adapter);
    }

    return getAdaptedModel(model, adapter);
  }

  middleware(middleware: Middleware) {
    if (!this.hasOwnProperty("__middlewares") || !this.__middlewares) {
      this.__middlewares = new Set();
    }

    this.__middlewares.add(middleware);
  }

  connectSocket(scope: SocketScope = "project") {
    this.__socketsMap ??= new Map();

    const client = this;
    const scheme = "wss://";
    const endpoint = this.options.endpoint;

    let url;

    if (scope === "project") {
      if (!this.options.project) {
        throw new ClientError({
          code: ErrorCodes.CLIENT_NO_PROJECT,
          message: "Client must be configured with a project to use socket",
        });
      }

      url = scheme + this.options.project + "." + endpoint;
    } else {
      url = scheme + endpoint;
    }

    const socket = io(url, {
      reconnectionDelayMax: 10000,
      rejectUnauthorized: false,
      auth: {
        token: this.options.accessToken,
      },
    });

    debugSocket(`Connecting socket on scope ${scope} (${url}) ...`);

    socket.on("connect", () => {
      debugSocket(`Socket connected on scope ${scope} (${url})`);

      const adapter = this.getClientAdapter();
      if (adapter.__modelsMap) {
        useRealtimeOnSocket(socket, Array.from(adapter.__modelsMap.keys()));
      }
    });

    // socket.on("connect_error", (e) => {
    //   debugSocket(`Socket error on scope ${scope} (${url}) : ${e}`);
    // });

    // socket.on("disconnect", () => {
    //   debugSocket(`Socket disconnected on scope ${scope} (${url})`);
    // });

    socket.on("realtime:event", (event: ModelCrudEvent & any) => {
      const model = client.getModel(event.model);
      const adapter = model.getAdapter() as ClientAdapter;

      event.__socketId = socket.id;

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

  async genAccountToken(accountId: string) {
    return await executeController(this, controllersMap.genAccountToken, {
      path: {
        id: accountId,
      },
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

  async ql(models: string[]) {
    const query = Object.fromEntries(models.map((m) => [m, true]));
    return await executeController(this, controllersMap.ql, { query });
  }

  async sync(
    config: Record<string, Record<string, any>>,
    opts: { confirm?: boolean; clean?: boolean }
  ) {
    return await executeController(this, controllersMap.sync, {
      query: opts,
      body: config,
    });
  }

  async currentUser() {
    const User = this.getModel(models.User);
    const data = await executeController(this, controllersMap.currentUser);
    // TODO: return mapOrNew user
    return new User(data);
  }

  async currentAccount() {
    const Account = this.getModel(models.Account);
    const data = await executeController(this, controllersMap.currentAccount);
    // TODO: return mapOrNew account
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
