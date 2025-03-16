import { defineConfiguration, Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "./job.js";
import { Role } from "./role.js";
import { ValidatorTypes } from "@/enums/validator-types.js";

@modelDecorator()
export class Function extends Model {
  static __name = "Function";
  static configuration = defineConfiguration({
    slug: "functions",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.TEXT },
      labels: {
        type: PropertyTypes.OBJECT,
        additionalProperties: {
          type: PropertyTypes.TEXT,
        },
      },
      exposed: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      role: {
        type: PropertyTypes.RELATION,
        ref: Role.configuration.slug,
      },
      runtime: {
        type: PropertyTypes.ENUM,
        enum: ["deno"],
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
      _checksum: { type: PropertyTypes.TEXT },
      _size: { type: PropertyTypes.INTEGER },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        property: "name",
      },
    ],
  });
}
