import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { Job } from "@/models/job.js";
import { MergeRequest } from "@/models/merge-request.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Environment extends Model {
  static __name = "Environment";
  static configuration = defineModelConf({
    slug: "environments",
    blockMultipleOperations: true,
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: {
        type: PropertyTypes.STRING,
      },
      base: {
        type: PropertyTypes.RELATION,
        ref: "environments", // Circular reference
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
      _fromRequest: {
        type: PropertyTypes.RELATION,
        ref: MergeRequest.configuration.slug,
      },
    },
    validators: [
      {
        type: ValidatorTypes.REGEX,
        property: "name",
        pattern: "^(?!master$|main$)[a-z0-9]+$",
      },
    ],
  });
}
