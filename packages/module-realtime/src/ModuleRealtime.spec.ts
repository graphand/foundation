import { DataModel } from "@graphand/core";
import ModuleRealtime from "./ModuleRealtime";
import { Client } from "@graphand/client";

const accessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoidG9rZW4iLCJpZCI6IjY2ODY5ZDBiNmM4NzM4OGQ4NWVlNzA3ZCIsImlhdCI6MTcyMDA5ODA4NSwiZXhwIjoxNzIwMTAxNjg1fQ.tfPzdctofBPezFjrFrWREMqjUvE0IQaIpvqt_UGuSBI";

describe("ModuleRealtime", () => {
  it("should ...", async () => {
    expect(true).toBe(true);

    const client = new Client([[ModuleRealtime]], {
      project: "667ed344d28ed7d740c82413",
      accessToken,
      headers: {
        "X-Access-Key": "test123",
      },
    });

    await client.init();

    await client.get("realtime").connect();

    const socket = client.get("realtime").getSocket();

    console.log(socket);

    socket.emit("subscribeModels", "datamodels");

    const dm = await client.getModel(DataModel).create({
      slug: "todo2",
      definition: {},
    });

    console.log(dm?.toJSON());

    await dm.delete();

    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.destroy();
  });
});
