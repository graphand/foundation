import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { JobTypes } from "@/enums/job-types.js";
import { JobStatus } from "@/enums/job-status.js";

@modelDecorator()
export class Job extends Model {
  static __name = "Job";
  static configuration = defineConfiguration({
    slug: "jobs",
    realtime: true,
    loadDatamodel: false,
    properties: {
      _type: {
        type: PropertyTypes.ENUM,
        options: {
          enum: Object.values(JobTypes),
        },
      },
      _status: {
        type: PropertyTypes.ENUM,
        options: {
          enum: Object.values(JobStatus),
          default: JobStatus.QUEUED,
        },
      },
      _refs: {
        type: PropertyTypes.ARRAY,
        options: {
          items: {
            type: PropertyTypes.TEXT,
          },
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
