import { getClient, isTypescriptProject, withSpinner } from "@/lib/utils.js";
import { DataModel } from "@graphand/core";
import { Command } from "commander";
import fs from "fs";
import path from "path";

export const commandGenModels = new Command("models")
  .description("Gen models")
  .option("-o --out-dir <outDir>", "The output directory for the generated files")
  .action(async options => {
    await withSpinner(async spinner => {
      const client = await getClient();

      const datamodels = await client.getModel(DataModel).getList();

      if (datamodels.count > 100) {
        throw new Error("Too many datamodels");
      }

      if (!options.outDir) {
        throw new Error("Out dir is required");
      }

      const extension = isTypescriptProject() ? "ts" : "js";

      const outDir = path.resolve(options.outDir);

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      for (const datamodel of datamodels) {
        if (!datamodel.name) {
          console.log(`Datamodel ${datamodel.slug} has no name`);
          continue;
        }

        const filename = datamodel.name + "." + extension;

        spinner.text = `Generating ${filename} ...`;

        const content = `
import { DataModel } from "@graphand/core";

class ${datamodel.name} extends DataModel {
  static __name = "Data<${datamodel.name}>";
  static slug = "${datamodel.slug}";
  static definition = ${JSON.stringify(datamodel.definition)};
}

export default ${datamodel.name};
      `;

        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, content.trim());
      }

      spinner.text = `Generation successful`;
    });
  });
