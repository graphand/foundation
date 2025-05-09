import { Module, symbolModuleInit, symbolModuleDestroy, ClientAdapter, BehaviorSubject } from "@graphand/client";
import { ModelCrudEvent } from "@graphand/core";
import { io, Socket } from "socket.io-client";
import RealtimeUpload from "./lib/RealtimeUpload.js";

type ModuleRealtimeOptions = {
  connectTimeout?: number;
  subscribeModels?: Array<string>;
  autoSubscribe?: boolean;
  autoConnect?: boolean;
  transports?: string[];
  handleConnectError?: (_error: Error) => void;
};

class ModuleRealtime extends Module<ModuleRealtimeOptions> {
  static moduleName = "realtime" as const;
  defaults: Partial<ModuleRealtimeOptions> = { connectTimeout: 5000, autoSubscribe: true, autoConnect: true };

  #uploadsMap = new Map<string, RealtimeUpload>();
  #subscribedModelsSubject = new BehaviorSubject<Array<string>>([]);
  #unsubscribeModels: (() => void) | undefined;
  #socketSubject = new BehaviorSubject<Socket | undefined>(undefined);
  #connectPromise: Promise<void> | undefined;
  #unsubscribeOptions: (() => void) | undefined;
  #connectTimeout: NodeJS.Timeout | undefined;

  async [symbolModuleInit]() {
    this.#unsubscribeModels = this.#subscribedModelsSubject.subscribe(models => {
      const socket = this.getSocket(false);
      if (socket?.connected && models.length) {
        socket.emit("subscribeModels", models.join(","));
      }
    });

    if (this.conf.autoConnect) {
      this.#unsubscribeOptions = this.client.subscribeOptions((options, previousOptions) => {
        // First time initialization
        if (!previousOptions && !options.accessToken) {
          return;
        }

        if (options.accessToken !== previousOptions?.accessToken) {
          if (options.accessToken) {
            this.connect();
          } else {
            this.disconnect();
          }
        }
      });
    }

    if (this.conf.subscribeModels?.length) {
      this.subscribeModels(this.conf.subscribeModels);
    }

    if (this.conf.autoSubscribe) {
      const _module = this as ModuleRealtime;
      const adapterClass = this.client.getAdapterClass();
      const subscribe = adapterClass.prototype.subscribe;
      adapterClass.prototype.subscribe = function (...args: Parameters<typeof subscribe>) {
        const adapter = this as ClientAdapter;
        const model = adapter.model;
        if (!model?.configuration.restricted && model?.configuration.slug) {
          _module.subscribeModels([model.configuration.slug]);
        }
        return subscribe.apply(this, args);
      };
    }
  }

  [symbolModuleDestroy]() {
    this.close();
  }

  get socketSubject() {
    return this.#socketSubject;
  }

  getSubscribedModels(): Array<string> {
    return Array.from(new Set(this.#subscribedModelsSubject.getValue()));
  }

  getSocket(autoConnect: boolean = true): Socket | undefined {
    if (autoConnect && !this.#socketSubject.getValue()) {
      this.connect();
    }

    return this.#socketSubject.getValue();
  }

  connect(force: boolean = false) {
    if (!this.client.options.accessToken) {
      throw new Error("Access token is required to connect to the socket");
    }

    let socket = this.getSocket(false);
    const protocol = this.client.getProtocol().replace("http", "ws");
    const url = this.client.getBaseUrl(protocol);

    // Check the current socket uri
    // @ts-expect-error - uri exists on io
    if (force || (socket && socket.io.uri !== url)) {
      socket && socket.close();
      this.#connectTimeout && clearTimeout(this.#connectTimeout);
      this.#connectPromise = undefined;
      socket = undefined;
    }

    if (this.#connectPromise) {
      return this.#connectPromise;
    }

    // Trying to recycle the current socket
    if (!socket) {
      const project = this.client.getProject();
      socket = io(url, {
        reconnection: true,
        reconnectionDelayMax: this.conf.connectTimeout,
        rejectUnauthorized: false,
        transports: this.conf.transports,
        auth: {
          accessToken: this.client.options.accessToken,
          project,
        },
      });

      this.#socketSubject.next(socket);

      socket.on("connect", () => {
        const subscribedModels = this.getSubscribedModels();
        if (subscribedModels?.length) {
          socket?.emit("subscribeModels", subscribedModels.join(","));
        }
      });

      socket.on("realtime:event", (event: ModelCrudEvent) => {
        // The server is not supposed to send events for models that are not subscribed
        // Just an extra check to make sure
        if (!this.#subscribedModelsSubject.getValue().includes(event.model)) {
          return;
        }

        const model = this.client.model(event.model);
        const adapter = model.getAdapter() as ClientAdapter;

        Object.assign(event, { __socketId: socket?.id });

        adapter.dispatch(event);
      });
    } else if (socket.disconnected) {
      socket.connect();
    }

    this.#connectPromise = new Promise<void>((resolve, reject) => {
      this.#connectTimeout = setTimeout(() => {
        _end();
        this.disconnect();
        reject(new Error("Connection timeout"));
      }, this.conf.connectTimeout);

      const _handleConnectError = (e: Error) => {
        _end();

        if (typeof this.conf.handleConnectError === "function") {
          try {
            this.conf.handleConnectError(e);
            resolve();
          } catch (e) {
            reject(e);
          }
          return;
        }

        reject(e);
      };

      const _handleConnect = () => {
        _end();

        this.#subscribedModelsSubject.trigger();
        resolve();
      };

      const _end = () => {
        this.#connectTimeout && clearTimeout(this.#connectTimeout);
        socket.off("connect", _handleConnect);
        socket.off("connect_error", _handleConnectError);
      };

      socket.once("connect", _handleConnect);
      socket.once("connect_error", _handleConnectError);
    });

    return this.#connectPromise;
  }

  getUpload(_id: string): RealtimeUpload {
    let upload = this.#uploadsMap.get(_id);

    if (!upload) {
      upload = new RealtimeUpload(this, _id);
      this.#uploadsMap.set(_id, upload);
    }

    this.getSocket();

    return upload;
  }

  subscribeModels(models: Array<string>) {
    if (!models.length) {
      return;
    }

    const subscribedModels = this.#subscribedModelsSubject.getValue();
    const nextValue = Array.from(new Set([...subscribedModels, ...models]));
    this.#subscribedModelsSubject.next(nextValue);
  }

  disconnect() {
    this.getSocket(false)?.close();
    this.#connectTimeout && clearTimeout(this.#connectTimeout);
    this.#connectPromise = undefined;
  }

  close() {
    this.#unsubscribeModels?.();
    this.#unsubscribeOptions?.();
    this.disconnect();
  }
}

export default ModuleRealtime;
