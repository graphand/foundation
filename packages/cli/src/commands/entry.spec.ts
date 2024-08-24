import { vi } from "vitest";
import { commandEntry } from "./entry";
import { controllerEntry } from "@graphand/core";
import { createClient } from "@/lib/utils";

describe("Entry Command", () => {
  const client = createClient();
  client.declareGlobally(); // Declare the client globally, the cli is using the global client if available
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(client, "execute");

  it("should fetch the entry point", async () => {
    await commandEntry.parseAsync();

    expect(client.execute).toHaveBeenCalledWith(controllerEntry);
    expect(console.log).toHaveBeenCalled();

    const firstCall = consoleLogSpy.mock.calls[0][0];
    const secondCall = consoleLogSpy.mock.calls[1][0];

    expect(firstCall).toBe("");
    expect(secondCall).toBeDefined();

    const json = JSON.parse(secondCall);

    expect(json).toMatchObject({
      version: expect.any(String),
      core: expect.any(String),
      project: client.options.project,
    });
  });
});
