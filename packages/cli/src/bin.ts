#!/usr/bin/env node

import { program } from "commander";
import { version } from "../package.json";
import { commandInit } from "./commands/init.js";
import { commandEntry } from "./commands/entry.js";
import { commandRegister } from "./commands/register.js";
import { commandLogin } from "./commands/login.js";
import { commandLogout } from "./commands/logout.js";
import { commandOptions } from "./commands/options.js";
import { commandWhoami } from "./commands/whoami.js";
import { commandExecute } from "./commands/execute.js";
import { commandGet } from "./commands/get.js";
import { commandCount } from "./commands/count.js";
import { commandDescribe } from "./commands/describe.js";
import { commandDelete } from "./commands/delete.js";
import { commandCreate } from "./commands/create.js";
import { commandUpdate } from "./commands/update.js";
import { commandDeploy } from "./commands/deploy.js";
import { commandRun } from "./commands/run/index.js";
import { commandLogs } from "./commands/logs/index.js";
import { commandSrc } from "./commands/src.js";
import { commandModels } from "./commands/models.js";
import { commandGdx } from "./commands/gdx/index.js";
import { commandGen } from "./commands/gen/index.js";

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
program.addCommand(commandModels);
program.addCommand(commandGdx);
program.addCommand(commandGen);

program.hook("postAction", async () => {
  const client = globalThis.client;
  if (client) {
    await client.destroy().catch(() => null);
  }
});

program.parse(process.argv);
