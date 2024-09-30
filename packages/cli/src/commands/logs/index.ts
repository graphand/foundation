import { Command } from "commander";
import { commandLogsFunction } from "./function.ts";
import { commandLogsJob } from "./job.ts";

export const commandLogs = new Command("logs").description("Get logs").action(() => {
  console.log("logs");
});

commandLogs.addCommand(commandLogsFunction);
commandLogs.addCommand(commandLogsJob);
