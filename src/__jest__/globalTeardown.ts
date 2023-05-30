import { models } from "@graphand/core";

export default async () => {
  const client = globalThis.client;

  await globalThis.project?.delete();

  client.close();
};
