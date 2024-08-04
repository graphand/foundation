import { defineConfig } from "@graphand/cli";

export default defineConfig({
  client: {
    // endpoint: "api.graphand.me:1337",
    // ssl: false,
    // project: "6674a2980052a0c329b61807",
    endpoint: "api.graphand.dev",
    project: "667ed344d28ed7d740c82413",
    environment: "master",
    headers: {
      "X-Access-Key": "test123",
    },
  },
});
