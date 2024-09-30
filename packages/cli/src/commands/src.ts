import { Command } from "commander";
import { getClient, withSpinner } from "@/lib/utils.ts";
import { controllerMediaPrivate, controllerMediaPublic, Media, MediaTransformOptions } from "@graphand/core";
import open from "open";

export const commandSrc = new Command("src")
  .description("Get media url")
  .arguments("<key>")
  .option("-w --width <width>", "Width of the thumbnail")
  .option("-h --height <height>", "Height of the thumbnail")
  .option("-q --quality <quality>", "Quality of the thumbnail")
  .option("-f --fit <fit>", "Fit of the thumbnail. cover | contain | fill | inside | outside")
  .option("-o --open", "Open the media in the browser")
  .action(async (key, options) => {
    return withSpinner(async spinner => {
      const client = await getClient();

      const media = await client.getModel(Media).get(key);

      if (!media) {
        throw new Error(`Media ${key} not found`);
      }

      const transformOptions: MediaTransformOptions = {};

      if (options.width) {
        transformOptions.w = Number(options.width);

        if (isNaN(transformOptions.w)) {
          throw new Error(`Invalid width ${options.width}`);
        }
      }

      if (options.height) {
        transformOptions.h = Number(options.height);

        if (isNaN(transformOptions.h)) {
          throw new Error(`Invalid height ${options.height}`);
        }
      }

      if (options.quality) {
        transformOptions.q = Number(options.quality);

        if (isNaN(transformOptions.q)) {
          throw new Error(`Invalid quality ${options.quality}`);
        }
      }

      if (options.fit) {
        transformOptions.fit = options.fit as NonNullable<MediaTransformOptions["fit"]>;

        if (!["cover", "contain", "fill", "inside", "outside"].includes(transformOptions.fit)) {
          throw new Error(`Invalid fit ${options.fit}`);
        }
      }

      const controller = media.private ? controllerMediaPrivate : controllerMediaPublic;

      const url = client.buildUrl(controller, {
        params: { id: media._id as string },
        query: transformOptions as Record<string, string>,
      });

      spinner.succeed(url);

      if (options.open) {
        open(url);
      }
    });
  });
