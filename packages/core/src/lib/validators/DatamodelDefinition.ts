import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/Validator.js";
import { DataModel } from "@/models/DataModel.js";
import { ModelInstance } from "@/types/index.js";
import { isValidDefinition } from "@/lib/utils.js";

export class ValidatorDatamodelDefinition extends Validator<ValidatorTypes.DATAMODEL_DEFINITION> {
  validate: Validator<ValidatorTypes.DATAMODEL_DEFINITION>["validate"] = async ({ list }) => {
    return !list.some((m: ModelInstance<typeof DataModel>) => !isValidDefinition(m.definition));
  };
}
