import ModuleAuth from "./ModuleAuth";
import { Client } from "@graphand/client";

describe("ModuleAuth", () => {
  it("should ...", async () => {
    expect(true).toBe(true);

    const client = new Client([[ModuleAuth]]);

    await client.get("auth").login({});
  });
});
