import packageJson from "../../package.json" assert { type: "json" };
import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.js";
import { controllerEntry } from "@graphand/core";
import { Client } from "@graphand/client";

export const commandVersion = new Command("version").description("Get the current version").action(async () => {
  await withSpinner(async spinner => {
    const client = await getClient();
    const headClient = new Client([], {
      ...client.options,
      disableCache: true,
      project: null,
    });

    console.info("Fetching entry point ...");

    const json = await client.execute(controllerEntry).then(r => r.json());
    const jsonHead = await headClient.execute(controllerEntry).then(r => r.json());

    spinner.succeed("Fetched entry point successfully");

    return {
      cli: packageJson.version,
      server: json.data.version,
      head: jsonHead.data.version,
    };
  });
});
