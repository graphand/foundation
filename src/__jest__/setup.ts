import "../modules";
import Client from "../lib/Client";
import "cross-fetch/polyfill";

const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);

const client = new Client({
  ...clientOptions,
});

globalThis.client = client;

afterAll(async () => {
  globalThis.client.close();
});
