import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ModelDefinition } from "@/types/index.ts";
import { Job } from "./Job.ts";

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
