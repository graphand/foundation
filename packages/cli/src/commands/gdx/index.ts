import { Command } from "commander";
import { commandGdxPull } from "./pull";
import { commandGdxPush } from "./push";

export const commandGdx = new Command("gdx").description("gdx management").action(() => {
  console.log("gdx");
});

commandGdx.addCommand(commandGdxPull);
commandGdx.addCommand(commandGdxPush);
