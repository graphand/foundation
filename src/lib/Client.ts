import {
  Model,
  controllersMap,
  models,
  ModelCrudEvent,
  getAdaptedModel,
  AuthProviders,
  AuthMethods,
  AuthProviderCredentials,
  AuthMethodOptions,
  InputModelPayload,
  Account,
  AuthProviderConfigurePayload,
  ControllerDefinition,
  HookPhase,
  FormProcessEvent,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import BehaviorSubject from "./BehaviorSubject";
import {
  executeController,
  getControllerUrl,
  handleAuthRedirect,
  handleAuthResponse,
  useFormsOnSocket,
  useRealtimeOnSocket,
} from "./utils";
import {
  ClientOptions,
  SocketScope,
  ClientHook,
  ClientHookPayload,
} from "../types";
import { io, Socket } from "socket.io-client";
import ClientError from "./ClientError";
import ErrorCodes from "../enums/error-codes";
import defaultAuthControllersMap from "./defaultAuthControllersMap";
import Subject from "./Subject";

const debug = require("debug")("graphand:client");
const debugSocket = require("debug")("graphand:socket");

const defaultOptions: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  environment: "master",
  sockets: ["project"],
  authControllersMap: defaultAuthControllersMap,
};

class Client {
  static __hooks: Set<ClientHook<any, any>>;

  __optionsSubject: BehaviorSubject<ClientOptions>;
  __adapterClass?: typeof ClientAdapter;
  __socketsMap: Map<SocketScope, Socket>;
  __sendingFormKeysSubject: BehaviorSubject<Set<string>>;
  __formsEventSubject: Subject<FormProcessEvent>;

  constructor(options: ClientOptions) {
    if (options.handleAuthRedirect) {
      handleAuthRedirect(options);
    }

    this.__optionsSubject = new BehaviorSubject(options);
    this.__sendingFormKeysSubject = new BehaviorSubject(new Set());

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

    const sendingFormKeysSub = this.__sendingFormKeysSubject.subscribe(
      (sendingKeys) => {
        const projectSocket = this.__socketsMap?.get("project");
        if (projectSocket && sendingKeys?.size) {
          useFormsOnSocket(projectSocket, Array.from(sendingKeys));
        }
      }
    );
  }

  src(
    idOrName: string,
    opts: {
      w?: string | number;
      h?: string | number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
    } = {},
    _private = false
  ) {
    const controller = _private
      ? controllersMap.mediaPrivate
      : controllersMap.mediaPublic;
    const { w, h, fit } = opts;

    const path = { idOrName };
    const query: any = { w, h, fit };

    if (_private) {
      query.token = this.options.accessToken;
    }

    return getControllerUrl(this, controller, { path, query });
  }

  get options(): ClientOptions {
    const opts = Object.fromEntries(
      Object.entries(this.__optionsSubject.getValue()).filter(
        ([_, v]) => v !== undefined
      )
    );

    return Object.assign({}, defaultOptions, opts);
  }

  get formsEvent() {
    this.__formsEventSubject ??= new Subject();
    return this.__formsEventSubject;
  }

  static hook<P extends HookPhase, C extends ControllerDefinition>(
    phase: P,
    fn: ClientHook<P, C>["fn"],
    controller?: C,
    order: number = 0
  ) {
    const hook: ClientHook<P, C> = { phase, fn, controller, order };

    this.__hooks ??= new Set();
    this.__hooks.add(hook);
  }

  async executeHooks<P extends HookPhase, C extends ControllerDefinition>(
    phase: P,
    controller: C,
    payload: ClientHookPayload<P>
  ): Promise<void> {
    const constructor = this.constructor as typeof Client;
    const hooks = Array.from(constructor.__hooks || [])
      .filter((hook) => {
        if (hook.phase !== phase) {
          return false;
        }

        if (hook.controller && hook.controller !== controller) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.order - b.order);

    await hooks.reduce(async (p, hook) => {
      await p;

      try {
        await hook.fn.call(this, payload);
      } catch (e) {
        payload.err ??= [];
        payload.err.push(e);
      }
    }, Promise.resolve());
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

      const sendingFormKeys = this.__sendingFormKeysSubject.getValue();
      if (sendingFormKeys.size) {
        useFormsOnSocket(socket, Array.from(sendingFormKeys));
      }
    });

    // socket.on("connect_error", (e) => {
    //   debugSocket(`Socket error on scope ${scope} (${url}) : ${e}`);
    // });

    // socket.on("disconnect", () => {
    //   debugSocket(`Socket disconnected on scope ${scope} (${url})`);
    // });

    socket.on("realtime:event", (event: ModelCrudEvent) => {
      const model = client.getModel(event.model);
      const adapter = model.getAdapter() as ClientAdapter;

      // @ts-ignore
      event.__socketId = socket.id;

      adapter.__eventSubject.next(event);
    });

    socket.on("form:event", (event: FormProcessEvent) => {
      this.__formsEventSubject?.next(event);
    });

    this.__socketsMap.set(scope, socket);
  }

  close() {
    this.__socketsMap?.forEach((socket) => socket.close());
  }

  // controllers

  async executeController(
    controller: Parameters<typeof executeController>[1],
    opts?: Parameters<typeof executeController>[2]
  ) {
    return await executeController(this, controller, opts);
  }

  async infos() {
    return await this.executeController(controllersMap.infos);
  }

  async infosProject() {
    return await this.executeController(controllersMap.infosProject);
  }

  async registerUser(credentials: { email: string; password: string }) {
    const { email, password } = credentials;

    return await this.executeController(controllersMap.registerUser, {
      body: { email, password },
    });
  }

  async genAccountToken(accountId: string) {
    return await this.executeController(controllersMap.genAccountToken, {
      path: {
        id: accountId,
      },
    });
  }

  async loginAccount<
    P extends AuthProviders = AuthProviders.PASSWORD,
    M extends AuthMethods = AuthMethods.WINDOW
  >(
    providerOrData:
      | {
          provider?: P;
          method?: M;
          credentials?: AuthProviderCredentials<P>;
          options?: AuthMethodOptions<M>;
        }
      | P,
    methodOrData?:
      | {
          method?: M;
          credentials?: AuthProviderCredentials<P>;
          options?: AuthMethodOptions<M>;
        }
      | M,
    data?: {
      credentials?: AuthProviderCredentials<P>;
      options?: AuthMethodOptions<M>;
    }
  ) {
    let body: {
      provider: P;
      method: M;
      credentials: AuthProviderCredentials<P>;
      options: AuthMethodOptions<M>;
    };

    if (data && typeof data === "object") {
      body = data as typeof body;
    } else {
      body = {} as typeof body;
    }

    if (typeof providerOrData === "string") {
      body.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(body, providerOrData);
    }

    if (typeof methodOrData === "string") {
      body.method = methodOrData;
    } else if (methodOrData) {
      Object.assign(body, methodOrData);
    }

    body.method ??= AuthMethods.WINDOW as M;

    if (body.method === AuthMethods.REDIRECT) {
      body.options ??= {} as any;
      const options = body.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= window.location.href;
    }

    const res = await this.executeController(controllersMap.loginAccount, {
      body,
    });

    const { accessToken, refreshToken } = await handleAuthResponse(
      res,
      body.method,
      this
    );

    this.setOptions({
      accessToken,
      refreshToken,
    });
  }

  async registerAccount<
    P extends AuthProviders = AuthProviders.PASSWORD,
    M extends AuthMethods = AuthMethods.WINDOW
  >(
    providerOrData:
      | {
          provider?: P;
          method?: M;
          account?: Omit<InputModelPayload<typeof Account>, "role">;
          configuration?: AuthProviderConfigurePayload<P>;
          options?: AuthMethodOptions<M>;
        }
      | P,
    methodOrData?:
      | {
          method?: M;
          account?: Omit<InputModelPayload<typeof Account>, "role">;
          configuration?: AuthProviderConfigurePayload<P>;
          options?: AuthMethodOptions<M>;
        }
      | M,
    data?: {
      account?: Omit<InputModelPayload<typeof Account>, "role">;
      configuration?: AuthProviderConfigurePayload<P>;
      options?: AuthMethodOptions<M>;
    }
  ) {
    let body: {
      provider: P;
      method: M;
      account?: Omit<InputModelPayload<typeof Account>, "role">;
      configuration?: AuthProviderConfigurePayload<P>;
      options: AuthMethodOptions<M>;
    };

    if (data && typeof data === "object") {
      body = data as typeof body;
    } else {
      body = {} as typeof body;
    }

    if (typeof providerOrData === "string") {
      body.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(body, providerOrData);
    }

    if (typeof methodOrData === "string") {
      body.method = methodOrData;
    } else if (methodOrData) {
      Object.assign(body, methodOrData);
    }

    body.method ??= AuthMethods.WINDOW as M;

    if (body.method === AuthMethods.REDIRECT) {
      body.options ??= {} as any;
      const options = body.options as AuthMethodOptions<AuthMethods.REDIRECT>;
      options.redirect ??= window.location.href;
    }

    const res = await this.executeController(controllersMap.registerAccount, {
      body,
    });

    const { accessToken, refreshToken } = await handleAuthResponse(
      res,
      body.method,
      this
    );

    this.setOptions({ accessToken, refreshToken });
  }

  async configureAuth<P extends AuthProviders>(
    providerOrData:
      | {
          provider?: P;
          configuration?: AuthProviderConfigurePayload<P>;
        }
      | P,
    data?: {
      configuration?: AuthProviderConfigurePayload<P>;
    }
  ) {
    let body: {
      provider: P;
      configuration?: AuthProviderConfigurePayload<P>;
    };

    if (data && typeof data === "object") {
      body = data as typeof body;
    } else {
      body = {} as typeof body;
    }

    if (typeof providerOrData === "string") {
      body.provider = providerOrData;
    } else if (providerOrData) {
      Object.assign(body, providerOrData);
    }

    return await this.executeController(controllersMap.configureAuth, {
      body,
    });
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
    return await this.executeController(controllersMap.ql, { query });
  }

  async sync(
    config: Record<string, Record<string, any>>,
    opts: { confirm?: boolean; clean?: boolean }
  ) {
    return await this.executeController(controllersMap.sync, {
      query: opts,
      body: config,
    });
  }

  async currentUser() {
    const User = this.getModel(models.User);
    const data = await this.executeController(controllersMap.currentUser);
    // TODO: return mapOrNew user
    return new User(data);
  }

  async currentAccount() {
    const Account = this.getModel(models.Account);
    const data = await this.executeController(controllersMap.currentAccount);
    // TODO: return mapOrNew account
    return new Account(data);
  }

  async genToken(tokenId: string) {
    return await this.executeController(controllersMap.genToken, {
      path: {
        id: tokenId,
      },
    });
  }
}

export default Client;
