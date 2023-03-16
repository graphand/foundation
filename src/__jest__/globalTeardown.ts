import { models } from "@graphand/core";

export default async () => {
  const client = globalThis.client;

  await client.getModel(models.Project).delete({
    ids: [process.env.PROJECT_ID],
  });

  client.close();
};
