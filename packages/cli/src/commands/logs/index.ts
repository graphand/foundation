import { Command } from "commander";
import { commandLogsFunction } from "./function";
import { commandLogsJob } from "./job";

export const commandLogs = new Command("logs").description("Get logs").action(() => {
  console.log("logs");
});

commandLogs.addCommand(commandLogsFunction);
commandLogs.addCommand(commandLogsJob);
