import { Command } from "commander";
import { commandRunFunction } from "./function.js";

export const commandRun = new Command("run").description("Run an aggregation or a function").action(() => {
  console.log("run");
});

commandRun.addCommand(commandRunFunction);
