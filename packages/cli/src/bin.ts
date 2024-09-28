#!/usr/bin/env node

import { program } from "commander";
import { version } from "../package.json";
import { commandInit } from "./commands/init";
import { commandEntry } from "./commands/entry";
import { commandRegister } from "./commands/register";
import { commandLogin } from "./commands/login";
import { commandLogout } from "./commands/logout";
import { commandOptions } from "./commands/options";
import { commandWhoami } from "./commands/whoami";
import { commandExecute } from "./commands/execute";
import { commandGet } from "./commands/get";
import { commandCount } from "./commands/count";
import { commandDescribe } from "./commands/describe";
import { commandDelete } from "./commands/delete";
import { commandCreate } from "./commands/create";
import { commandUpdate } from "./commands/update";
import { commandDeploy } from "./commands/deploy";
import { commandRun } from "./commands/run";
import { commandLogs } from "./commands/logs";
import { commandSrc } from "./commands/src";

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

program.hook("postAction", async () => {
  const client = globalThis.client;
  if (client) {
    await client.destroy().catch(() => null);
  }
});

program.parse(process.argv);
