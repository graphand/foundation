class Module<Conf extends unknown = unknown> {
  static moduleName: string;

  #conf: Conf;

  constructor(conf: Conf) {
    this.#conf = conf;
  }

  get conf() {
    return this.#conf;
  }
}

export default Module;
