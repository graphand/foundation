import { Model } from "@graphand/core";
import { Socket } from "socket.io-client";
import { SocketScope } from "../types";
import Client from "../lib/Client";
import { getClientFromModel, useRealtimeOnSocket } from "../lib/utils";

const awaitSocket = async (client: Client, scope: SocketScope = "project") => {
  const socket = client.__socketsMap?.get(scope);
  if (!socket) {
    return;
  }

  if (socket.connected) {
    return true;
  }

  return new Promise((resolve, reject) => {
    socket.on("connect", () => {
      resolve(true);
    });

    socket.on("connect_error", (e) => {
      reject(e);
    });
  });
};

const awaitSockets = async (client: Client) => {
  if (!client.__socketsMap) {
    return;
  }

  const scopes = Array.from(client.__socketsMap.keys());
  return Promise.all(scopes.map((s) => awaitSocket(client, s)));
};

Model.realtime = async function () {
  const client = getClientFromModel(this);
  if (!client.__socketsMap) {
    return;
  }

  await awaitSockets(client);
  const sockets = Array.from(client.__socketsMap.values());
  sockets.forEach((socket: Socket) => {
    useRealtimeOnSocket(socket, [this.slug]);
  });
};

Model.hook("before", "initialize", async function () {
  await this.realtime();
});
