import { Model } from "@graphand/core";
import { Socket } from "socket.io-client";
import { getClientFromModel, useRealtimeOnSocket } from "../lib/utils";

Model.realtime = function () {
  const client = getClientFromModel(this);
  const sockets = Array.from(client.__socketsMap?.values() || []);
  sockets.forEach((socket: Socket) => {
    useRealtimeOnSocket(socket, [this.slug]);
  });
};

Model.hook("before", "initialize", function () {
  this.realtime();
});
