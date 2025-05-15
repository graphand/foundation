import { RequestHelper, Route } from "@graphand/server";
import { controllerEntry } from "@graphand/core";

export class RouteEntry extends Route<typeof controllerEntry> {
  controller = controllerEntry;

  async fetch(req: RequestHelper): Promise<Response> {
    console.log(req.url.toString());
    return new Response("Hello, world!");
  }
}
