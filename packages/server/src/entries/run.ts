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
          mongo: {
            uri: env.DATABASE_MONGO_URI,
            username: env.DATABASE_MONGO_USERNAME,
            password: env.DATABASE_MONGO_PASSWORD,
            maxTimeMS: 10000,
            maxCount: 100000,
            maxLimit: 1000,
          },
          redis: {
            uri: env.DATABASE_REDIS_URI,
            password: env.DATABASE_REDIS_PASSWORD,
            cluster: env.DATABASE_REDIS_CLUSTER,
          },
          hooks: {
            orderBefore: -2,
            orderAfter: 2,
          },
          cache: {
            enabled: true,
            ttl: 60 * 60 * 24, // 1 day
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
