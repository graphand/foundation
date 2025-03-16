import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { DataModel } from "@/models/data-model.js";
import { ModelInstance } from "@/types/index.js";
import { validateDatamodel } from "../utils.js";

export class ValidatorDatamodel extends Validator<ValidatorTypes.DATAMODEL> {
  validate: Validator<ValidatorTypes.DATAMODEL>["validate"] = async ({ list, model }) => {
    const adapter = model?.getAdapter(false);

    list.forEach(m => {
      const dm = m as unknown as ModelInstance<typeof DataModel>;
      if (!validateDatamodel(dm.toJSON(), adapter)) {
        throw new Error(`invalid definition for model "${dm.slug}"`);
      }
    });

    return true;
  };
}
