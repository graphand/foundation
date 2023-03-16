import Client from "../lib/Client";

const client = new Client({
  endpoint: "api.graphand.cloud",
  sockets: [],
});

globalThis.client = client;

afterAll(async () => {
  globalThis.client.close();
});
