import Client from "../lib/Client";
import { models } from "@graphand/core";
import { generateRandomString } from "../lib/test-utils";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export default async () => {
  const client = new Client({
    endpoint: "api.graphand.io.local:1337",
    sockets: [],
  });

  await client.loginUser({
    email: "hello@pierrecabriere.fr",
    password: "test123",
  });

  const organization = await client.getModel(models.Organization).get({});

  const project = await client.getModel(models.Project).create({
    name: generateRandomString(),
    slug: generateRandomString(),
    organization: organization?._id,
  });

  process.env.CLIENT_OPTIONS = JSON.stringify({
    ...client.options,
    project: project._id,
  });
  process.env.PROJECT_ID = project._id;

  globalThis.client = client;
};
