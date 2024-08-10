import { Client, ClientModules, ClientOptions, ModuleConstructor } from "@graphand/client";
import { vi } from "vitest";
import { commandEntry } from "./entry";
import { controllerEntry } from "@graphand/core";

export const createClient = <T extends ModuleConstructor[] = ModuleConstructor[]>(
  modules: ClientModules<T> = [] as ClientModules<T>,
  options: Partial<ClientOptions> = {},
): Client<T> => {
  options ??= {};
  options.endpoint ??= process.env.ENDPOINT;
  options.ssl ??= process.env.SSL !== "0";
  options.accessToken ??= process.env.ACCESS_TOKEN;
  options.project ??= process.env.PROJECT;
  options.headers ??= {};
  options.headers["X-Access-Key"] ??= process.env.ACCESS_KEY;
  return new Client(modules, options as ClientOptions);
};

describe("Entry Command", () => {
  const client = createClient();
  client.declareGlobally();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(client, "execute");

  it("should ...", async () => {
    await commandEntry.parseAsync();

    expect(client.execute).toHaveBeenCalledWith(controllerEntry);
    expect(console.log).toHaveBeenCalledWith("\nProject Details:");
  });
});
