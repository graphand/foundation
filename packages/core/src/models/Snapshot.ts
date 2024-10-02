import { Model } from "@/lib/Model.js";
import { modelDecorator } from "@/lib/modelDecorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { Job } from "./Job.js";

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
