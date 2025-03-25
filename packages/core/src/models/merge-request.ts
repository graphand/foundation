import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { Job } from "@/models/job.js";
import { MergeRequestTypes } from "@/enums/merge-request-types.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class MergeRequest extends Model {
  static __name = "MergeRequest";
  static configuration = defineModelConf({
    slug: "mergeRequests",
    noBulk: true,
    realtime: true,
    loadDatamodel: false,
    keyProperty: "slug",
    properties: {
      slug: { type: PropertyTypes.STRING },
      type: {
        type: PropertyTypes.STRING,
        enum: Object.values(MergeRequestTypes),
        default: MergeRequestTypes.STATIC,
      },
      options: {
        type: PropertyTypes.OBJECT,
        properties: {
          source: {
            type: PropertyTypes.STRING,
          },
          query: {
            type: PropertyTypes.OBJECT,
          },
          gdx: {
            type: PropertyTypes.OBJECT,
          },
        },
      },
      target: { type: PropertyTypes.STRING },
      _closed: {
        type: PropertyTypes.BOOLEAN,
        default: false,
      },
      _job: {
        type: PropertyTypes.RELATION,
        ref: Job.configuration.slug,
      },
    },
    required: ["options", "target"],
  });
}
