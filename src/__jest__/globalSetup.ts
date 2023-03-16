import Client from "../lib/Client";
import "cross-fetch/polyfill";
import { models } from "@graphand/core";
import { generateRandomString } from "../lib/test-utils";

export default async () => {
  const client = new Client({
    endpoint: "api.graphand.cloud",
    sockets: [],
  });

  await client.loginUser({
    email: "hello@pierrecabriere.fr",
    password: "test123",
  });

  const project = await client.getModel(models.Project).create({
    name: generateRandomString(),
    slug: generateRandomString(),
    organization: "640920dbee6309dc4bd5290d",
  });

  process.env.CLIENT_OPTIONS = JSON.stringify(client.options);
  process.env.PROJECT_ID = project._id;

  globalThis.client = client;
};
