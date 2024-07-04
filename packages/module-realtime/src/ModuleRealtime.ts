import { Module, symbolModuleInit, symbolModuleDestroy, ClientAdapter } from "@graphand/client";
import { ModelCrudEvent, UploadEvent } from "@graphand/core";
import { io, Socket } from "socket.io-client";

class ModuleRealtime extends Module<{ connectTimeout?: number; autoConnect?: boolean }> {
  static moduleName = "realtime" as const;
  defaults = { connectTimeout: 5000, autoConnect: true };

  #socket: Socket | undefined;
  #connectPromise: Promise<void> | undefined;
  #unsubscribe: (() => void) | undefined;

  async [symbolModuleInit]() {
    if (this.conf.autoConnect) {
      this.#unsubscribe = this.client().subscribeOptions((options, previousOptions) => {
        // First time initialization
        if (!previousOptions && !options.accessToken) {
          console.warn("Access token is required to connect to the socket");
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
  }

  [symbolModuleDestroy]() {
    this.close();
  }

  getSocket(): Socket {
    if (!this.#socket) {
      this.connect();
    }

    return this.#socket as Socket;
  }

  connect(force: boolean = false) {
    const client = this.client();

    if (!client.options.accessToken) {
      throw new Error("Access token is required to connect to the socket");
    }

    if (this.#connectPromise && !force) {
      return this.#connectPromise;
    }

    if (this.#socket) {
      this.#socket.close();
    }

    const scheme = client.options.ssl ? "wss" : "ws";
    const url = client.getBaseUrl(scheme);

    const socket = io(url, {
      reconnectionDelayMax: 10000,
      rejectUnauthorized: false,
      auth: {
        accessToken: client.options.accessToken,
        project: client.options.project,
      },
    });

    console.log(`Connecting socket on ${url} ...`);

    let rejectTimeout: NodeJS.Timeout | undefined;

    this.#socket = socket;
    this.#connectPromise = new Promise<void>((resolve, reject) => {
      rejectTimeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
        this.disconnect();
      }, this.conf.connectTimeout);

      socket.on("connect", () => {
        console.log(`Socket connected`);

        resolve();

        // const adapter = client.getAdapterClass();
        // if (adapter?._modelsRegistry?.size) {
        //   useRealtimeOnSocket(socket, Array.from(adapter._modelsRegistry.keys()));
        // }

        // const sendingFormKeys = this.__sendingFormKeysSubject.getValue();
        // if (sendingFormKeys.size) {
        //   useUploadsOnSocket(socket, Array.from(sendingFormKeys));
        // }
      });

      socket.on("connect_error", e => {
        console.log(`Socket error : ${e}`);

        reject(e);
      });

      socket.on("info", info => {
        console.log(`Socket info : ${info?.message}`);
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected`);
      });

      socket.on("realtime:event", (event: ModelCrudEvent) => {
        const model = client.getModel(event.model);
        const adapter = model.getAdapter() as ClientAdapter;

        Object.assign(event, { __socketId: socket.id });

        adapter.dispatch(event);
      });

      socket.on("upload:event", (event: UploadEvent) => {
        console.log("ok");
        // this.__uploadEventsSubject?.next(event);
      });
    }).finally(() => {
      if (rejectTimeout) {
        clearTimeout(rejectTimeout);
      }
    });

    return this.#connectPromise;
  }

  disconnect() {
    this.#connectPromise = undefined;
    this.#socket?.close();
  }

  close() {
    this.#unsubscribe?.();
    this.disconnect();
  }
}

export default ModuleRealtime;
