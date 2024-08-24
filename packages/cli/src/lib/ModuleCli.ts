import { Module, symbolModuleInit, symbolModuleDestroy, FetchError } from "@graphand/client";
import { getClient } from "./utils";
import chalk from "chalk";

class ModuleCli extends Module {
  static moduleName = "cli" as const;
  defaults = {};

  async [symbolModuleInit]() {
    const client = this.client() as unknown as Awaited<ReturnType<typeof getClient>>;

    client.hook(
      "afterRequest",
      async ({ err, res }) => {
        if (res?.headers.get("content-type").includes("application/json")) {
          const json = await res.clone().json();
          if (json.jobs?.length && Array.isArray(globalThis.jobs)) {
            globalThis.jobs.push(...json.jobs);
          }
        }

        const unauthorized = err?.find(e => (e as FetchError).res?.status === 401) as FetchError;
        if (unauthorized) {
          throw new Error(
            `Unauthorized action: ${unauthorized.message}.\n` +
              chalk.yellow(`Please login with \`graphand login\` or \`graphand register\` first`),
          );
        }
      },
      { handleErrors: true },
    );
  }

  async [symbolModuleDestroy]() {}
}

export default ModuleCli;
