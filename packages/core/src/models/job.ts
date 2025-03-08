import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { JobTypes } from "@/enums/job-types.js";
import { JobStatus } from "@/enums/job-status.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Job extends Model {
  static __name = "Job";
  static slug = "jobs" as const;
  static realtime = true as const;
  static loadDatamodel = false as const;
  static definition = {
    fields: {
      _type: {
        type: FieldTypes.ENUM,
        options: {
          enum: Object.values(JobTypes),
        },
      },
      _status: {
        type: FieldTypes.ENUM,
        options: {
          enum: Object.values(JobStatus),
          default: JobStatus.QUEUED,
        },
      },
      _refs: {
        type: FieldTypes.ARRAY,
        options: {
          items: {
            type: FieldTypes.TEXT,
          },
        },
      },
      _startedAt: {
        type: FieldTypes.DATE,
      },
      _completedAt: {
        type: FieldTypes.DATE,
      },
      _result: {
        type: FieldTypes.OBJECT,
      },
    },
  } as const satisfies ModelDefinition;
}
