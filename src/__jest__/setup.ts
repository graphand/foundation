import "../modules";
import Client from "../lib/Client";

jest.setTimeout(10000);
jest.retryTimes(3);

const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);

const client = new Client({
  ...clientOptions,
});

globalThis.client = client;

afterAll(async () => {
  globalThis.client.close();
});
