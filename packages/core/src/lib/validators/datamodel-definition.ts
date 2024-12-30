import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { DataModel } from "@/models/data-model.js";
import { ModelInstance } from "@/types/index.js";
import { validateDefinition } from "../utils.js";

export class ValidatorDatamodelDefinition extends Validator<ValidatorTypes.DATAMODEL_DEFINITION> {
  validate: Validator<ValidatorTypes.DATAMODEL_DEFINITION>["validate"] = async ({ list }) => {
    list.forEach((m: ModelInstance<typeof DataModel>) => {
      if (!validateDefinition(m.definition)) {
        throw new Error(`invalid definition for model "${m.slug}"`);
      }
    });

    return true;
  };
}
