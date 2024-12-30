import { ValidatorTypes } from "@/enums/validator-types.js";
import { ModelInstance } from "@/types/index.js";
import type { DataModel } from "@/models/data-model.js";
import { Validator } from "@/lib/validator.js";
import { Adapter } from "@/lib/adapter.js";
import { ValidationValidatorError } from "../validation-validator-error.js";

export class ValidatorDatamodelSlug extends Validator<ValidatorTypes.DATAMODEL_SLUG> {
  validate: Validator<ValidatorTypes.DATAMODEL_SLUG>["validate"] = async ({ list, model }) => {
    const modelsMap = model?.getAdapter(false)?.base.getRecursiveModelsMap() || Adapter.getRecursiveModelsMap();

    const _list = list as Array<ModelInstance<typeof DataModel>>;
    const values = _list.map(i => i.get("slug")).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    values.forEach((slug: string | undefined) => {
      if (slug && modelsMap.has(slug) && !modelsMap.get(slug)?.extensible) {
        throw new ValidationValidatorError({
          validator: this,
          message: `model slug "${slug}" is reserved`,
          value: slug,
        });
      }
    });

    return true;
  };
}
