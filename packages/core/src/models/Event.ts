import { Model } from "@/lib/Model";
import { modelDecorator } from "@/lib/modelDecorator";
import { FieldTypes } from "@/enums/field-types";
import { ModelDefinition } from "@/types";

@modelDecorator()
export class Event extends Model {
  static __name = "Event";
  static slug = "events" as const;
  static definition = {
    fields: {
      type: { type: FieldTypes.TEXT },
      level: {
        type: FieldTypes.TEXT,
        options: { enum: ["info", "warning", "error"], strict: true },
      },
      message: { type: FieldTypes.TEXT },
      notify: { type: FieldTypes.BOOLEAN },
    },
  } satisfies ModelDefinition;
}
