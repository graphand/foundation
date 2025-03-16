import { Model, defineConfiguration } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { EventSources } from "@/enums/event-sources.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { EventSeverities } from "@/enums/event-severities.js";

@modelDecorator()
export class Event extends Model {
  static __name = "Event";
  static configuration = defineConfiguration({
    slug: "events",
    loadDatamodel: false,
    properties: {
      type: { type: PropertyTypes.TEXT },
      message: { type: PropertyTypes.TEXT },
      tags: { type: PropertyTypes.ARRAY, options: { items: { type: PropertyTypes.TEXT } } },
      payload: { type: PropertyTypes.OBJECT },
      mute: { type: PropertyTypes.BOOLEAN, options: { default: false } },
      severity: { type: PropertyTypes.INTEGER, options: { default: EventSeverities.DEBUG } }, // Syslog protocol severity levels (0-7)
      _source: {
        type: PropertyTypes.ENUM,
        options: { enum: Object.values(EventSources), default: EventSources.USER },
      },
    },
    validators: [
      {
        type: ValidatorTypes.REQUIRED,
        options: { property: "type" },
      },
      {
        type: ValidatorTypes.BOUNDARIES,
        options: { property: "severity", min: 0, max: 7 },
      },
    ],
  });
}
