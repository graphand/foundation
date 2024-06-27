import {
  Model,
  controllersMap,
  ModelCrudEvent,
  AuthProviders,
  AuthMethods,
  AuthMethodOptions,
  AuthProviderConfigurePayload,
  ControllerDefinition,
  HookPhase,
  UploadEvent,
  Account,
  ModelJSON,
  MediaTransformOptions,
} from "@graphand/core";
import ClientAdapter from "./ClientAdapter";
import BehaviorSubject from "./BehaviorSubject";
import {
  executeController,
  getControllerUrl,
  handleAuthRedirect,
  handleAuthResponse,
  useUploadsOnSocket,
  useRealtimeOnSocket,
} from "./utils";
import {
  ClientOptions,
  ClientHook,
  ClientHookPayload,
  LoginData,
} from "../types";
import { io, Socket } from "socket.io-client";
import ClientError from "./ClientError";
import defaultAuthControllersMap from "./defaultAuthControllersMap";
import Subject from "./Subject";

const debug = require("debug")("graphand:client");
const debugSocket = require("debug")("graphand:socket");

const defaultOptions: Partial<ClientOptions> = {
  endpoint: "api.graphand.cloud",
  environment: "master",
  socket: true,
  authControllersMap: defaultAuthControllersMap,
  ssl: true,
};

class Client {
  static __hooks: Set<ClientHook<any, any>>;

  __optionsSubject: BehaviorSubject<ClientOptions>;
  __adapterClass?: typeof ClientAdapter;
  __socket: Socket;
  __sendingFormKeysSubject: BehaviorSubject<Set<string>>;
  __uploadEventsSubject: Subject<UploadEvent>;
  __refreshingTokenPromise?: Promise<void>;

  __unsubscribeOptions: () => void;
  __unsubscribeForms: () => void;

  constructor(options: ClientOptions) {
    if (options.handleAuthRedirect) {
      handleAuthRedirect(options);
    }

    this.__optionsSubject = new BehaviorSubject(options);
    this.__sendingFormKeysSubject = new BehaviorSubject(new Set());

    this.__unsubscribeOptions = this.__optionsSubject.subscribe(
      (next, prev) => {
        if (prev) {
          if (
            next.socket &&
            (next.endpoint !== prev.endpoint ||
              next?.accessToken !== prev.accessToken)
          ) {
            this.connectSocket();
          } else if (next.socket !== prev.socket) {
            if (next.socket) {
              this.connectSocket();
            } else {
              this.disconnectSocket();
            }
          }
        } else if (next.socket && !this.__socket) {
          this.connectSocket();
        }
      }
    );

    this.__unsubscribeForms = this.__sendingFormKeysSubject.subscribe(
      (sendingKeys) => {
        if (this.__socket && sendingKeys?.size) {
          useUploadsOnSocket(this.__socket, Array.from(sendingKeys));
        }
      }
    );
  }

  src(idOrName: string, opts: MediaTransformOptions = {}, _private = false) {
    const controller = _private
      ? controllersMap.mediaPrivate
      : controllersMap.mediaPublic;
    const { w, h, q, fit } = opts;

    const path = { id: idOrName };
    const query: MediaTransformOptions & { token?: string } = { w, h, q, fit };

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

  get uploadEvents() {
    this.__uploadEventsSubject ??= new Subject();
    return this.__uploadEventsSubject;
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

  getModel: (typeof Model)["getClass"] = (input) => {
    return Model.getClass(input, this.getClientAdapter());
  };

  getBaseUrl(scheme?: string) {
    scheme ??= this.options.ssl ? "https" : "http";
    let url: string = scheme + "://";
    if (this.options.scope) url += this.options.scope + ".";
    if (this.options.endpoint) url += this.options.endpoint;
    return url;
  }

  connectSocket() {
    const scheme = this.options.ssl ? "wss" : "ws";
    const url = this.getBaseUrl(scheme);

    const socket = io(url, {
      reconnectionDelayMax: 10000,
      rejectUnauthorized: false,
      auth: {
        accessToken: this.options.accessToken,
        project: this.options.scope,
      },
    });

    debugSocket(`Connecting socket on ${url} ...`);

    socket.on("connect", () => {
      debugSocket(`Socket connected`);

      const adapter = this.getClientAdapter();
      if (adapter._modelsRegistry?.size) {
        useRealtimeOnSocket(socket, Array.from(adapter._modelsRegistry.keys()));
      }

      const sendingFormKeys = this.__sendingFormKeysSubject.getValue();
      if (sendingFormKeys.size) {
        useUploadsOnSocket(socket, Array.from(sendingFormKeys));
      }
    });

    socket.on("connect_error", (e) => {
      debugSocket(`Socket error : ${e}`);
    });

    socket.on("info", (info) => {
      debugSocket(`Socket info : ${info?.message}`);
    });

    socket.on("disconnect", () => {
      debugSocket(`Socket disconnected`);
    });

    socket.on("realtime:event", (event: ModelCrudEvent) => {
      const model = this.getModel(event.model);
      const adapter = model.getAdapter() as ClientAdapter;

      Object.assign(event, { __socketId: socket.id });

      adapter.__eventSubject.next(event);
    });

    socket.on("upload:event", (event: UploadEvent) => {
      this.__uploadEventsSubject?.next(event);
    });

    if (this.__socket) {
      this.__socket.close();
    }

    this.__socket = socket;
  }

  disconnectSocket() {
    if (!this.__socket) {
      throw new ClientError({
        message: `Socket is not configured`,
      });
    }

    debugSocket(`Disconnecting socket ...`);

    this.__socket.close();
    this.__socket = null;
  }

  close() {
    this.__unsubscribeOptions?.();
    this.__unsubscribeForms?.();
    if (this.__socket) {
      this.disconnectSocket();
    }
  }

  async executeController(
    controller: Parameters<typeof executeController>[1],
    opts?: Parameters<typeof executeController>[2]
  ) {
    return await executeController(this, controller, opts);
  }

  // helpers

  async genAccountToken(accountId: string) {
    return await this.executeController(controllersMap.genAccountToken, {
      path: { id: accountId },
    });
  }

  async login<
    P extends AuthProviders = AuthProviders.LOCAL,
    M extends AuthMethods = AuthMethods.WINDOW
  >(
    providerOrData: LoginData<P, M> | P,
    methodOrData?: Omit<LoginData<P, M>, "provider"> | M,
    data?: Omit<LoginData<P, M>, "provider" | "method">,
    query?: Record<string, string>
  ) {
    let body: LoginData<P, M>;

    if (data && typeof data === "object") {
      body = data;
    } else {
      body = {};
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

    const res = await this.executeController(controllersMap.login, {
      query,
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

  async register<
    P extends AuthProviders = AuthProviders.LOCAL,
    M extends AuthMethods = AuthMethods.WINDOW
  >(
    providerOrData:
      | {
          provider?: P;
          method?: M;
          account?: Omit<ModelJSON<typeof Account>, "role">;
          configuration?: AuthProviderConfigurePayload<P>;
          options?: AuthMethodOptions<M>;
        }
      | P,
    methodOrData?:
      | {
          method?: M;
          account?: Omit<ModelJSON<typeof Account>, "role">;
          configuration?: AuthProviderConfigurePayload<P>;
          options?: AuthMethodOptions<M>;
        }
      | M,
    data?: {
      account?: Omit<ModelJSON<typeof Account>, "role">;
      configuration?: AuthProviderConfigurePayload<P>;
      options?: AuthMethodOptions<M>;
    }
  ) {
    let body: {
      provider: P;
      method: M;
      account?: Omit<ModelJSON<typeof Account>, "role">;
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

    const res = await this.executeController(controllersMap.register, {
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

  async refreshToken() {
    if (this.__refreshingTokenPromise) {
      return await this.__refreshingTokenPromise;
    }

    if (!this.options.accessToken || !this.options.refreshToken) {
      // TODO: throw a more specific error
      throw new ClientError();
    }

    const controller = controllersMap.refreshToken;

    this.__refreshingTokenPromise = new Promise(async (resolve, reject) => {
      try {
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

        resolve();
      } catch (err) {
        reject(err);
      } finally {
        delete this.__refreshingTokenPromise;
      }
    });

    return await this.__refreshingTokenPromise;
  }

  async currentAccount() {
    const model = this.getModel(Account);
    const data = await this.executeController(controllersMap.currentAccount);
    // TODO: return mapOrNew account
    return model.hydrate(data);
  }

  async genTokenToken(tokenId: string) {
    return await this.executeController(controllersMap.genTokenToken, {
      path: {
        id: tokenId,
      },
    });
  }

  async genKeyToken(keyId: string, identityToken: string) {
    return await this.executeController(controllersMap.genKeyToken, {
      path: {
        id: keyId,
      },
      body: {
        identityToken,
      },
    });
  }

  async subscriptionsCurrent() {
    return await this.executeController(controllersMap.subscriptionsCurrent);
  }
}

export default Client;
