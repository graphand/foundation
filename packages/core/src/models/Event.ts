import { Model } from "@/lib/Model.ts";
import { modelDecorator } from "@/lib/modelDecorator.ts";
import { FieldTypes } from "@/enums/field-types.ts";
import { ModelDefinition } from "@/types/index.ts";
import { EventSources } from "@/enums/event-sources.ts";
import { ValidatorTypes } from "@/enums/validator-types.ts";
import { EventSeverities } from "@/enums/event-severities.ts";

@modelDecorator()
export class Event extends Model {
  static __name = "Event";
  static slug = "events" as const;
  static definition = {
    fields: {
      type: { type: FieldTypes.TEXT },
      message: { type: FieldTypes.TEXT },
      tags: { type: FieldTypes.ARRAY, options: { items: { type: FieldTypes.TEXT } } },
      payload: { type: FieldTypes.NESTED },
      mute: { type: FieldTypes.BOOLEAN, options: { default: false } },
      severity: { type: FieldTypes.NUMBER, options: { default: EventSeverities.DEBUG } }, // Syslog protocol severity levels (0-7)
      _source: {
        type: FieldTypes.TEXT,
        options: { enum: Object.values(EventSources), default: EventSources.USER, strict: true },
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
  } satisfies ModelDefinition;
}
