import Client from "./Client";

const symbolModuleInit = Symbol("ModuleInit");

class Module<Conf extends unknown = unknown> {
  static moduleName: string;

  #conf: Conf;
  #client: Client;

  constructor(conf: Conf, client: Client) {
    if (!client) {
      throw new Error("Client is required");
    }

    this.#conf = conf;
    this.#client = client;
  }

  get conf() {
    return this.#conf;
  }

  get client() {
    return this.#client;
  }

  [symbolModuleInit](): Promise<void> | void {}
}

export default Module;
export { symbolModuleInit };
