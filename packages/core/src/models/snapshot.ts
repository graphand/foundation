import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "./job.js";

@modelDecorator()
export class Snapshot extends Model {
  static __name = "Snapshot";
  static configuration = defineConfiguration({
    slug: "snapshots",
    blockMultipleOperations: true,
    loadDatamodel: false,
    properties: {
      _expiresAt: {
        type: PropertyTypes.DATE,
      },
      _job: {
        type: PropertyTypes.RELATION,
        options: {
          ref: Job.configuration.slug,
        },
      },
    },
  });
}
