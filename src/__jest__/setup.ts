import "../modules";
import Client from "../lib/Client";

// jest.setTimeout(10000);
// jest.retryTimes(3);

const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);

const client = new Client({
  ...clientOptions,
});

client.declareGlobally();

globalThis.client = client;

afterAll(async () => {
  client.close();
});
