import { ValidatorTypes } from "@/enums/validator-types.ts";
import { Validator } from "@/lib/Validator.ts";
import { DataModel } from "@/models/DataModel.ts";
import { ModelInstance } from "@/types/index.ts";
import { isValidDefinition } from "@/lib/utils.ts";

export class ValidatorDatamodelDefinition extends Validator<ValidatorTypes.DATAMODEL_DEFINITION> {
  validate: Validator<ValidatorTypes.DATAMODEL_DEFINITION>["validate"] = async ({ list }) => {
    return !list.some((m: ModelInstance<typeof DataModel>) => !isValidDefinition(m.definition));
  };
}
