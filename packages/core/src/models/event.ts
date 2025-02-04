import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { FieldTypes } from "@/enums/field-types.js";
import { ModelDefinition } from "@/types/index.js";
import { EventSources } from "@/enums/event-sources.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { EventSeverities } from "@/enums/event-severities.js";

@modelDecorator()
export class Event extends Model {
  static __name = "Event" as const;
  static slug = "events" as const;
  static definition = {
    fields: {
      type: { type: FieldTypes.TEXT },
      message: { type: FieldTypes.TEXT },
      tags: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.TEXT } } },
      payload: { type: FieldTypes.OBJECT },
      mute: { type: FieldTypes.BOOLEAN, options: { default: false } },
      severity: { type: FieldTypes.INTEGER, options: { default: EventSeverities.DEBUG } }, // Syslog protocol severity levels (0-7)
      _source: {
        type: FieldTypes.ENUM,
        options: { enum: Object.values(EventSources), default: EventSources.USER },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        options: { field: "type" },
      },
      {
        type: ValidatorTypes.BOUNDARIES,
        options: { field: "severity", min: 0, max: 7 },
      },
    ],
  } as const satisfies ModelDefinition;
}
