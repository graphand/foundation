import { Command } from "commander";
import { commandGdxPull } from "./pull.ts";
import { commandGdxPush } from "./push.ts";

export const commandGdx = new Command("gdx").description("gdx management").action(() => {
  console.log("gdx");
});

commandGdx.addCommand(commandGdxPull);
commandGdx.addCommand(commandGdxPush);
