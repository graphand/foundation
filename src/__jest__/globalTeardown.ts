export default async () => {
  const client = globalThis.client;

  await globalThis.project?.delete();

  client.close();
};
