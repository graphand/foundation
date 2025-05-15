import { Module, symbolModuleInit, symbolModuleDestroy } from "@graphand/server";
import { z } from "zod";
import { DatabaseService } from "./lib/database-service.js";
import { init as initHooksSession } from "./hooks/session.js";
import { init as initHooksRetry } from "./hooks/retry.js";
import { init as initHooksParsePayload } from "./hooks/parse-payload.js";
import { init as initHooksParseQuery } from "./hooks/parse-query.js";
import { init as initHooksSystemFields } from "./hooks/system-fields.js";

const ModuleDatabaseSchema = z.object({
  uri: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),

  mongoMaxTimeMS: z.number(),
  mongoMaxCount: z.number(),

  hooks: z.object({
    orderBefore: z.number(),
    orderAfter: z.number(),
  }),
});

export class ModuleDatabase extends Module<typeof ModuleDatabaseSchema.shape> {
  static moduleName = "database" as const;
  schema = ModuleDatabaseSchema;
  defaults = {
    uri: "",
    hooks: {
      orderBefore: -2,
      orderAfter: 2,
    },
    mongoMaxTimeMS: 10000,
    mongoMaxCount: 100000,
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
  }
}
