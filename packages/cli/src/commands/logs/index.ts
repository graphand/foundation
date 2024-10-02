import { Command } from "commander";
import { commandLogsFunction } from "./function.js";
import { commandLogsJob } from "./job.js";

export const commandLogs = new Command("logs").description("Get logs").action(() => {
  console.log("logs");
});

commandLogs.addCommand(commandLogsFunction);
commandLogs.addCommand(commandLogsJob);
