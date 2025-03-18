import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { JobTypes } from "@/enums/job-types.js";
import { JobStatus } from "@/enums/job-status.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Job extends Model {
  static __name = "Job";
  static configuration = defineModelConf({
    slug: "jobs",
    realtime: true,
    loadDatamodel: false,
    properties: {
      _type: {
        type: PropertyTypes.STRING,
        enum: Object.values(JobTypes),
      },
      _status: {
        type: PropertyTypes.STRING,
        enum: Object.values(JobStatus),
        default: JobStatus.QUEUED,
      },
      _refs: {
        type: PropertyTypes.ARRAY,
        items: {
          type: PropertyTypes.STRING,
        },
      },
      _startedAt: {
        type: PropertyTypes.DATE,
      },
      _completedAt: {
        type: PropertyTypes.DATE,
      },
      _result: {
        type: PropertyTypes.OBJECT,
      },
    },
  });
}
