import { Model } from "@/lib/model.js";
import { modelDecorator } from "@/lib/model-decorator.js";
import { PropertyTypes } from "@/enums/property-types.js";
import { EventSources } from "@/enums/event-sources.js";
import { ValidatorTypes } from "@/enums/validator-types.js";
import { EventSeverities } from "@/enums/event-severities.js";
import { defineModelConf } from "@/lib/utils.js";

@modelDecorator()
export class Event extends Model {
  static __name = "Event";
  static configuration = defineModelConf({
    slug: "events",
    loadDatamodel: false,
    properties: {
      type: { type: PropertyTypes.STRING },
      message: { type: PropertyTypes.STRING },
      tags: { type: PropertyTypes.ARRAY, items: { type: PropertyTypes.STRING } },
      payload: { type: PropertyTypes.OBJECT },
      mute: { type: PropertyTypes.BOOLEAN, default: false },
      severity: { type: PropertyTypes.INTEGER, default: EventSeverities.DEBUG }, // Syslog protocol severity levels (0-7)
      _source: {
        type: PropertyTypes.STRING,
        enum: Object.values(EventSources),
        default: EventSources.USER,
      },
    },
    required: ["type"],
    validators: [
      {
        type: ValidatorTypes.BOUNDARIES,
        property: "severity",
        min: 0,
        max: 7,
      },
    ],
  });
}
