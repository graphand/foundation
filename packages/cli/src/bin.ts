#!/usr/bin/env node

import { program } from "commander";
import { version } from "../package.json";
import { commandInit } from "./commands/init.ts";
import { commandEntry } from "./commands/entry.ts";
import { commandRegister } from "./commands/register.ts";
import { commandLogin } from "./commands/login.ts";
import { commandLogout } from "./commands/logout.ts";
import { commandOptions } from "./commands/options.ts";
import { commandWhoami } from "./commands/whoami.ts";
import { commandExecute } from "./commands/execute.ts";
import { commandGet } from "./commands/get.ts";
import { commandCount } from "./commands/count.ts";
import { commandDescribe } from "./commands/describe.ts";
import { commandDelete } from "./commands/delete.ts";
import { commandCreate } from "./commands/create.ts";
import { commandUpdate } from "./commands/update.ts";
import { commandDeploy } from "./commands/deploy.ts";
import { commandRun } from "./commands/run/index.ts";
import { commandLogs } from "./commands/logs/index.ts";
import { commandSrc } from "./commands/src.ts";
import { commandModel } from "./commands/model.ts";
import { commandGdx } from "./commands/gdx/index.ts";

program
  .version(version)
  .description("Graphand CLI !")
  .option("-c --config <config>", "Path to the graphand configuration file");

program.addCommand(commandInit);
program.addCommand(commandEntry);
program.addCommand(commandRegister);
program.addCommand(commandLogin);
program.addCommand(commandLogout);
program.addCommand(commandOptions);
program.addCommand(commandWhoami);
program.addCommand(commandExecute);
program.addCommand(commandGet);
program.addCommand(commandCount);
program.addCommand(commandDescribe);
program.addCommand(commandDelete);
program.addCommand(commandCreate);
program.addCommand(commandUpdate);
program.addCommand(commandDeploy);
program.addCommand(commandRun);
program.addCommand(commandLogs);
program.addCommand(commandSrc);
program.addCommand(commandModel);
program.addCommand(commandGdx);

program.hook("postAction", async () => {
  const client = globalThis.client;
  if (client) {
    await client.destroy().catch(() => null);
  }
});

program.parse(process.argv);
