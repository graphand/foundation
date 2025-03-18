import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "./job.js";
import { Role } from "./role.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Function extends Model {
  static __name = "Function";
  static configuration = defineModelConf({
    slug: "functions",
    isEnvironmentScoped: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "name",
    properties: {
      name: { type: PropertyTypes.STRING },
      labels: {
        type: PropertyTypes.OBJECT,
        additionalProperties: {
          type: PropertyTypes.STRING,
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
        type: PropertyTypes.STRING,
        enum: ["deno"],
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
      _checksum: { type: PropertyTypes.STRING },
      _size: { type: PropertyTypes.INTEGER },
    },
    required: ["name"],
  });
}
