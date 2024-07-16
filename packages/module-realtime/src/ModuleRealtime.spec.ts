import { Client } from "@graphand/client";
import ModuleRealtime from "./ModuleRealtime";
import { Socket } from "socket.io-client";

describe("ModuleRealtime", () => {
  const client = new Client([[ModuleRealtime]], {
    accessToken: process.env.ACCESS_TOKEN,
    project: process.env.PROJECT,
    headers: {
      "X-Access-Key": process.env.ACCESS_KEY,
    },
  });

  const module = client.get("realtime");

  it("should be able to connect to the socket", async () => {
    expect(module).toBeInstanceOf(ModuleRealtime);

    await module.connect();

    const socket = module.getSocket();
    expect(socket).toBeInstanceOf(Socket);
    expect(socket.connected).toBeTruthy();

    await module.disconnect();

    expect(socket.connected).toBeFalsy();
  });
});
