import Client from "../lib/Client";

const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);

const client = new Client({
  ...clientOptions,
  project: process.env.PROJECT_ID,
});

globalThis.client = client;

afterAll(async () => {
  globalThis.client.close();
});