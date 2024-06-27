import { Model } from "@graphand/core";
import { useRealtimeOnSocket } from "../lib/utils";

Model.realtime = async function <T extends typeof Model>(this: T) {
  const client = this.getClient();

  if (!client.__socket) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    if (client.__socket.connected) {
      resolve();
      return;
    }

    client.__socket.once("connect", resolve);
    client.__socket.once("connect_error", reject);
  });

  useRealtimeOnSocket(client.__socket, [this.slug]);
};

Model.hook("before", "initialize", async function () {
  await this.realtime();
});
