import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "./job.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Snapshot extends Model {
  static __name = "Snapshot";
  static configuration = defineModelConf({
    slug: "snapshots",
    noBulk: true,
    loadDatamodel: false,
    properties: {
      _expiresAt: {
        type: PropertyTypes.DATE,
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
    },
  });
}
