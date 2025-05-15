import { Server } from "@/lib/server.js";
import { ModuleExample } from "@graphand/server-module-example";
import { ModuleDatabase } from "@graphand/server-module-database";
import { env } from "@/lib/env.js";

const run = async () => {
  const server = new Server(
    {
      appName: env.APP_NAME,
      wildcardDomain: env.WILDCARD_DOMAIN,
      port: 3000,
    },
    [
      [
        ModuleExample,
        {
          foo: "bar",
          bar: 42,
        },
      ],
      [
        ModuleDatabase,
        {
          uri: env.DATABASE_MONGO_URI,
          username: env.DATABASE_MONGO_USERNAME,
          password: env.DATABASE_MONGO_PASSWORD,
          mongoMaxTimeMS: 10000,
          mongoMaxCount: 100000,
          hooks: {
            orderBefore: -2,
            orderAfter: 2,
          },
        },
      ],
    ],
  );

  await server.init();

  console.log("Server started");

  server.start();
};

run();
