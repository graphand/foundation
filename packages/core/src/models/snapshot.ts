import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Job } from "./job.js";

@modelDecorator()
export class Snapshot extends Model {
  static __name = "Snapshot";
  static allowMultipleOperations = false;
  static slug = "snapshots" as const;
  static definition = {
    fields: {
      _expiresAt: {
        type: FieldTypes.DATE,
      },
      _job: {
        type: FieldTypes.RELATION,
        options: {
          ref: Job.slug,
        },
      },
    },
  } satisfies ModelDefinition;
}
