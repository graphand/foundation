import { DataModel } from "@graphand/core";
import ModuleRealtime from "./ModuleRealtime";
import { Client } from "@graphand/client";

describe("ModuleRealtime", () => {
  it("should ...", async () => {
    const client = new Client([[ModuleRealtime]], {
      project: String(process.env.PROJECT),
      accessToken: String(process.env.ACCESS_TOKEN),
      headers: {
        "X-Access-Key": String(process.env.ACCESS_KEY),
      },
    });

    await client.init();

    await client.get("realtime").connect();

    const socket = client.get("realtime").getSocket();

    socket.emit("subscribeModels", "datamodels");

    const dm = await client.getModel(DataModel).create({
      slug: "todo2",
      definition: {},
    });

    await dm.delete();

    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.destroy();
  });
});
