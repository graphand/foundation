#!/usr/bin/env node

import { Command } from "commander";
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
import { commandDescribe } from "./commands/describe";
import { commandDelete } from "./commands/delete";
import { commandCreate } from "./commands/create";

const program = new Command();

program.version(version).description("Graphand CLI !");

program.addCommand(commandInit);
program.addCommand(commandEntry);
program.addCommand(commandRegister);
program.addCommand(commandLogin);
program.addCommand(commandLogout);
program.addCommand(commandOptions);
program.addCommand(commandWhoami);
program.addCommand(commandExecute);
program.addCommand(commandGet);
program.addCommand(commandDescribe);
program.addCommand(commandDelete);
program.addCommand(commandCreate);

program.parse(process.argv);
