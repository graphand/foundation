import { ModuleDatabase } from "@/module.js";
import { ErrorCodes, Model } from "@graphand/core";
import { HTTPStatusCodes, RequestHelper, ServerError } from "@graphand/server";
import { ClientSession } from "mongodb";

type SessionHook = {
  event: "commit" | "abort" | "end" | "complete";
  fn: (_abort: boolean) => void | Promise<void>;
  order: number;
  executed?: boolean;
};

class SessionManager {
  #request: RequestHelper;
  #sessionsMap: Map<string, Promise<ClientSession>> = new Map(); // One session per db
  #hooks: Set<SessionHook> = new Set();
  #ended: boolean = false;
  #endCb: any;
  #endPromise?: Promise<void>;
  #modelsMap: Map<string, typeof Model> = new Map();
  #startDate: Date;

  constructor(request: RequestHelper, _bindEndCb: boolean = true) {
    this.#request = request;
    this.#startDate = new Date();

    // if (this.#request && bindEndCb) {
    //   this.#endCb = () => {
    //     return this.end(true).catch(() => null);
    //   };

    //   this.#request.eventEmitter.once("end", this.#endCb);
    // }
  }

  get startDate() {
    return this.#startDate;
  }

  hook(fn: SessionHook["fn"], event: SessionHook["event"] = "commit", order: number = 0) {
    const hook: SessionHook = { event, fn, order };
    this.#hooks.add(hook);
  }

  get hasEnded() {
    return Boolean(this.#ended);
  }

  model<T extends typeof Model>(model: T): T {
    const key = model.slug;

    if (!this.#modelsMap.has(key)) {
      const adapterClass = this.#request.getAdapterClass();
      const model = this.#request.model(key).extend({
        adapterClass,
        register: false,
        initOptions: {
          ctx: {
            sessionManager: this,
          },
        },
      });

      this.#modelsMap.set(key, model);
    }

    return this.#modelsMap.get(key) as T;
  }

  async getSessionForModel(model: typeof Model): Promise<ClientSession> {
    if (this.hasEnded) {
      throw new Error(`Session has ended. Unable to get session for model ${model.slug}`);
    }

    const service = this.#request.server.get(ModuleDatabase).service;
    const dbName = service.mongo.getDbNameForModel(model);

    if (!this.#sessionsMap.has(dbName)) {
      const session = service.mongo.createSession();
      this.#sessionsMap.set(dbName, session);

      return await session;
    }

    const session = await this.#sessionsMap.get(dbName);

    if (!session) {
      throw new Error(`Session for model ${model.slug} not found`);
    }

    return session;
  }

  async _end(abort: boolean = false, errsCallback?: (_errs: Error[]) => void | Promise<void>) {
    if (this.hasEnded) {
      throw new Error(`Session has ended. Unable to end session again with abort=${String(abort)}`);
    }

    // if (this.#endCb) {
    //   this.#request.eventEmitter.off("end", this.#endCb);
    // }

    const errs = [];

    const _execHooks = async (_hooks: Array<SessionHook>) => {
      const promises = _hooks.map(async h => {
        if (h.executed) {
          return;
        }

        h.executed = true;
        await h.fn(abort);
      });

      return await Promise.all(promises);
    };

    const endHooks = Array.from(this.#hooks).filter(h => h.event === "end");

    if (endHooks.length) {
      try {
        await _execHooks(endHooks);
      } catch (e) {
        errs.push(e);
        abort = true;
      }
    }

    this.#ended = true;

    await Promise.all(
      Array.from(this.#sessionsMap.entries()).map(async ([, p]) => {
        const session = await p;

        if (session.hasEnded) {
          return;
        }

        try {
          const endFunc = abort ? session.abortTransaction : session.commitTransaction;
          await endFunc?.apply(session);
        } catch (e) {
          errs.push(e);
        }

        await session.endSession();
      }),
    );

    const event = abort || errs.length ? "abort" : "commit";
    const hooks = Array.from(this.#hooks).filter(h => h.event === event);

    try {
      if (hooks.some(h => h.order !== 0)) {
        const groups = hooks.reduce(
          (acc, h) => {
            acc[h.order] = acc[h.order] || [];
            acc[h.order]?.push(h);

            return acc;
          },
          {} as Record<number, SessionHook[]>,
        );

        for (const order in groups) {
          await _execHooks(groups[order] || []);
        }
      } else {
        await _execHooks(hooks);
      }
    } catch (e) {
      if (event === "commit") {
        const abortHooks = Array.from(this.#hooks).filter(h => h.event === "abort");

        await _execHooks(abortHooks).catch(e => {
          this.#request.addResponseException(
            new ServerError({
              code: ErrorCodes.EXCEPTION,
              message: `Error executing abort hooks: ${e.message}`,
              httpStatusCode: HTTPStatusCodes.PARTIAL_CONTENT,
            }),
          );
        });
      }

      throw e;
    }

    const completeHooks = Array.from(this.#hooks).filter(h => h.event === "complete");

    await _execHooks(completeHooks).catch(e => {
      this.#request.addResponseException(
        new ServerError({
          code: ErrorCodes.EXCEPTION,
          message: `Error executing complete hooks: ${e.message}`,
          httpStatusCode: HTTPStatusCodes.PARTIAL_CONTENT,
        }),
      );
    });

    if (errs?.length) {
      if (typeof errsCallback === "function") {
        await errsCallback(errs as Error[]);
      } else {
        throw errs[0];
      }
    }
  }

  async end(abort: boolean = false, errsCallback?: (_errs: Error[]) => void | Promise<void>) {
    if (this.#endPromise) {
      return this.#endPromise;
    }

    this.#endPromise = this._end(abort, errsCallback);
    return this.#endPromise;
  }

  async reset() {
    // Cancel all sessions
    for await (const session of this.#sessionsMap.values()) {
      if (session.hasEnded) {
        continue;
      }

      await session.abortTransaction();
      await session.endSession();
    }

    this.#sessionsMap.clear();
    this.#endPromise = undefined;
    this.#ended = false;

    // if (this.#endCb) {
    //   this.#context.eventEmitter.off("end", this.#endCb);

    //   this.#endCb = () => {
    //     return this.end(true).catch(() => null);
    //   };

    //   this.#context.eventEmitter.once("end", this.#endCb);
    // }
  }
}

export default SessionManager;
