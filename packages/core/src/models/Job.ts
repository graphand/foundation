import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { JobTypes } from "@/enums/job-types.js";
import { JobStatus } from "@/enums/job-status.js";
import { ModelDefinition } from "@/types/index.js";

@modelDecorator()
export class Job extends Model {
  static __name = "Job";
  static slug = "jobs" as const;
  static definition = {
    fields: {
      _type: {
        type: FieldTypes.TEXT,
        options: {
          enum: Object.values(JobTypes),
          strict: true,
        },
      },
      _status: {
        type: FieldTypes.TEXT,
        options: {
          enum: Object.values(JobStatus),
          strict: true,
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
        type: FieldTypes.NESTED,
      },
    },
  } satisfies ModelDefinition;
}
