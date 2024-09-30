import { ValidatorTypes } from "@/enums/validator-types.ts";
import { ModelInstance } from "@/types/index.ts";
import type { DataModel } from "@/models/DataModel.ts";
import { Validator } from "@/lib/Validator.ts";
import { Adapter } from "../Adapter.ts";

export class ValidatorDatamodelSlug extends Validator<ValidatorTypes.DATAMODEL_SLUG> {
  validate: Validator<ValidatorTypes.DATAMODEL_SLUG>["validate"] = async ({ list, model }) => {
    const modelsMap = model?.getAdapter(false)?.base.getRecursiveModelsMap() || Adapter.getRecursiveModelsMap();

    const _list = list as Array<ModelInstance<typeof DataModel>>;
    const values = _list.map(i => i.get("slug")).filter(v => ![null, undefined].includes(v as any));

    if (!values?.length) return true;

    const _isInvalid = (slug: string | undefined) => {
      if (!slug || !modelsMap.has(slug)) {
        return false;
      }

      return !modelsMap.get(slug)?.extensible;
    };

    return !values.some(_isInvalid);
  };
}
