import Client from "../lib/Client";

export default async () => {
  const clientGlobal: Client = globalThis.clientGlobal;
  const clientProject: Client = globalThis.clientProject;

  await clientGlobal.close();
  await clientProject.close();
};
