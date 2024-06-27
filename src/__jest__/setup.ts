import "../modules";
import Client from "../lib/Client";
import { Role } from "@graphand/core";

jest.setTimeout(15000);
// jest.retryTimes(3);

const clientGlobalOptions = JSON.parse(process.env.CLIENT_GLOBAL_OPTIONS);
const clientProjectOptions = JSON.parse(process.env.CLIENT_PROJECT_OPTIONS);

const clientGlobal = new Client(clientGlobalOptions);
const clientProject = new Client(clientProjectOptions);

clientProject.declareGlobally();

globalThis.clientGlobal = clientGlobal;
globalThis.clientProject = clientProject;

afterAll(async () => {
  await globalThis.clientProject.getModel(Role).delete({
    filter: {
      _admin: { $ne: true },
    },
  });

  clientGlobal.close();
  clientProject.close();

  if (globalThis.clients?.length) {
    globalThis.clients.forEach((c) => c.close());
  }
});
