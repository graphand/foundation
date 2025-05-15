import { Server } from "@graphand/server";
import { ModuleExample } from "@graphand/server-module-example";

const run = async () => {
  const server = new Server(
    {
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
    ],
  );

  await server.init();

  server.start();
};

run();
