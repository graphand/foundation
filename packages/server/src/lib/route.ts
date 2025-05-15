import { Controller } from "@graphand/core";
import { RequestHelper } from "./request-helper.js";
export abstract class Route<C extends Controller = Controller> {
  abstract controller: C;
  abstract fetch(_req: RequestHelper): Promise<Response>;
}
