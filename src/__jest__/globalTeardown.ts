import { models } from "@graphand/core";

export default async () => {
  const client = globalThis.client;

  await models.Project.delete({
    ids: [process.env.PROJECT_ID],
  });

  client.close();
};
