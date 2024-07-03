import ModuleRealtime from "./ModuleRealtime";
import { Client } from "@graphand/client";

describe("ModuleRealtime", () => {
  it("should ...", async () => {
    expect(true).toBe(true);

    const client = new Client([[ModuleRealtime]]);

    await client.get("realtime");
  });
});
