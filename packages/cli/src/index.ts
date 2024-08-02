#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { version } from "../package.json";

const program = new Command();

program.version(version).description("Graphand CLI !");

program
  .command("init")
  .description("Initialize a new Graphand project")
  .action(() => {
    console.log(chalk.green("Initializing new Graphand project..."));
  });

program.parse(process.argv);
