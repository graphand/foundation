import { Module, symbolModuleInit, symbolModuleDestroy } from "@graphand/server";
import { z } from "zod";
import { DatabaseService } from "./lib/database-service.js";
import { init as initHooksSession } from "./hooks/session.js";
import { init as initHooksRetry } from "./hooks/retry.js";
import { init as initHooksParsePayload } from "./hooks/parse-payload.js";
import { init as initHooksParseQuery } from "./hooks/parse-query.js";
import { init as initHooksSystemFields } from "./hooks/system-fields.js";

const ModuleDatabaseSchema = z.object({
  mongo: z.object({
    uri: z.string().min(1),
    username: z.string().optional(),
    password: z.string().optional(),
    maxTimeMS: z.number(),
    maxCount: z.number(),
    maxLimit: z.number(),
  }),

  redis: z.object({
    uri: z.string().min(1),
    password: z.string().optional(),
    cluster: z.boolean().optional(),
  }),

  hooks: z.object({
    orderBefore: z.number(),
    orderAfter: z.number(),
  }),

  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number(),
  }),
});

export class ModuleDatabase extends Module<typeof ModuleDatabaseSchema.shape> {
  static moduleName = "database" as const;
  schema = ModuleDatabaseSchema;
  defaults = {
    mongo: {
      uri: "",
      username: "",
      password: "",
      maxTimeMS: 10000,
      maxCount: 100000,
      maxLimit: 1000,
    },
    redis: {
      uri: "localhost:6379",
      password: "",
      cluster: false,
    },
    cache: {
      enabled: true,
      ttl: 60 * 60 * 24,
    },
    hooks: {
      orderBefore: -2,
      orderAfter: 2,
    },
  };

  service: DatabaseService;

  constructor(...args: ConstructorParameters<typeof Module<typeof ModuleDatabaseSchema.shape>>) {
    super(...args);
    this.service = new DatabaseService(this);

    initHooksSession({
      orderBefore: this.conf.hooks?.orderBefore ?? -2,
      orderAfter: this.conf.hooks?.orderAfter ?? 2,
    });
    initHooksRetry();
    initHooksParsePayload();
    initHooksParseQuery();
    initHooksSystemFields();
  }

  async [symbolModuleInit]() {
    await this.service.init();
    console.log("ModuleDatabase init");
  }

  async [symbolModuleDestroy]() {
    console.log("ModuleDatabase destroy");
    await this.service.destroy();
  }
}
