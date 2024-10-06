import { Command } from "commander";
import { commandGenModels } from "./models.js";

export const commandGen = new Command("gen").description("Gen").action(() => {
  console.log("gen");
});

commandGen.addCommand(commandGenModels);
