import { getClient, isTypescriptProject, withSpinner } from "@/lib/utils.js";
import { DataModel, ModelDefinition } from "@graphand/core";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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

      const isTs = isTypescriptProject();
      const extension = isTs ? "ts" : "js";

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

        console.info(`Generating ${filename} ...`);

        const extendsExistingModel = datamodel.slug && client.getAdapterClass().getClosestModel(datamodel.slug);

        let definition = datamodel.definition as Partial<ModelDefinition>;

        if (extendsExistingModel) {
          const model = await client.getModel(extendsExistingModel);
          await model.initialize();

          if (definition.fields && extendsExistingModel.definition.fields) {
            Object.assign(definition, {
              fields: {
                ...extendsExistingModel.definition.fields,
                ...definition.fields,
              },
            });
          }
          if (definition.validators && extendsExistingModel.definition.validators) {
            Object.assign(definition, {
              validators: [...extendsExistingModel.definition.validators, ...definition.validators],
            });
          }
        }

        const lineImport = isTs
          ? `import { Model, ModelDefinition } from "@graphand/core"`
          : `import { Model } from "@graphand/core"`;

        const lineSlug = isTs ? `static slug = "${datamodel.slug}" as const` : `static slug = "${datamodel.slug}"`;

        const lineDefinition = isTs
          ? `static definition = ${JSON.stringify(definition)} as const satisfies ModelDefinition`
          : `static definition = ${JSON.stringify(definition)}`;

        const content = `
          ${lineImport}

          class ${datamodel.name} extends Model {
            static __name = "Data<${datamodel.name}>";
            ${lineSlug}
            ${lineDefinition}
          }

          export default ${datamodel.name};
        `.trim();

        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, content);

        execSync(`npx prettier --write ${filePath}`);
      }

      console.info(`Generation successful`);
    });
  });
