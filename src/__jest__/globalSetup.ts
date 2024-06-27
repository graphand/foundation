require("dotenv").config({ path: ".env.test" });

import { AuthMethods, AuthProviders } from "@graphand/core";
import Client from "../lib/Client";

export default async () => {
  const endpoint = process.env.CLIENT_ENDPOINT;
  const ssl = process.env.CLIENT_SSL === "1";

  const clientGlobal = new Client({
    endpoint,
    socket: false,
    ssl,
    headers: {
      "X-Access-Key": process.env.ACCESS_KEY,
    },
  });

  const email = process.env.AUTH_EMAIL;
  const password = process.env.AUTH_PASSWORD;

  await clientGlobal.login({
    credentials: {
      email,
      password,
    },
  });

  const projectId = process.env.PROJECT_ID;

  const clientProject = new Client({
    endpoint,
    scope: projectId,
    socket: true,
    ssl,
    headers: {
      "X-Access-Key": process.env.ACCESS_KEY,
    },
  });

  await clientProject.login(
    AuthProviders.GRAPHAND,
    AuthMethods.CODE,
    {},
    {
      graphandToken: clientGlobal.options.accessToken,
    }
  );

  process.env.CLIENT_GLOBAL_OPTIONS = JSON.stringify(clientGlobal.options);
  process.env.CLIENT_PROJECT_OPTIONS = JSON.stringify(clientProject.options);

  globalThis.clientGlobal = clientGlobal;
  globalThis.clientProject = clientProject;
};
