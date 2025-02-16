import { Model } from "@/lib/model.js";
import { FieldTypes } from "./enums/field-types.js";
import { HookData, JSONPrimitive, ModelDefinition, ModelJSON } from "@/types/index.js";
import { PromiseModel } from "./lib/promise-model.js";
import { Account } from "./models/account.js";
import { Role } from "./models/role.js";

class CustomModel extends Model {
  static slug = "customModel" as const;
  static definition = {
    fields: {
      field: {
        type: FieldTypes.TEXT,
      },
    },
  } as const satisfies ModelDefinition;
}

class CustomAccount extends Model {
  static slug = "accounts" as const;
  static definition = {
    ...Account.definition,
    fields: {
      ...Account.definition.fields,
      foo: {
        type: FieldTypes.TEXT,
      },
      bar: {
        type: "text",
      },
    },
  } as const satisfies ModelDefinition;
}

declare module "./types/index.js" {
  export interface ModelsOverrides {
    [CustomModel.slug]: typeof CustomModel;
    [CustomAccount.slug]: typeof CustomAccount;
  }
}

describe("test types", () => {
  const simulateTypeCheck = <ExpectedType>(obj: ExpectedType) => obj;

  type NoType<T, ExpectedType> = T extends ExpectedType ? never : T;
  type NoProperty<T, Prop extends PropertyKey> = {
    [K in keyof T]: K extends Prop ? never : T[K];
  };

  describe("fields type check", () => {
    it("utils should work", () => {
      class CustomModel extends Model {
        static definition = {
          fields: {
            title: {
              type: FieldTypes.TEXT,
            },
            subtitle: {
              type: "text",
            },
          },
        } as const satisfies ModelDefinition;
      }

      const i = CustomModel.hydrate();

      simulateTypeCheck<string | undefined>(i.title); // Check title found as a string
      simulateTypeCheck<string | undefined>(i.subtitle); // Check subtitle found as a string
      simulateTypeCheck<string | undefined>(i._id); // Check _id found as a string
      simulateTypeCheck<NoType<typeof i.title, number>>(i.title); // Check title is not a number
      simulateTypeCheck<NoType<typeof i.subtitle, number>>(i.subtitle); // Check subtitle is not a number

      simulateTypeCheck<NoProperty<typeof i, "foo">>(i); // Check foo is not found in i
    });

    describe("test object", () => {
      describe("text field", () => {
        it("should validate text field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.TEXT,
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | undefined>(i.field); // Check the field is a string
        });
      });

      describe("nested field", () => {
        it("should validate nested field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      title: {
                        type: FieldTypes.TEXT,
                      },
                    },
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | undefined>(i.field?.title); // Check the field is a string
          simulateTypeCheck<JSONPrimitive | undefined>(i.field?.unknown);
        });

        it("should respect options.strict", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.OBJECT,
                  options: {
                    fields: {
                      title: {
                        type: FieldTypes.TEXT,
                      },
                    },
                    strict: true,
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | undefined>(i.field?.title); // Check the field is a string
          simulateTypeCheck<NoProperty<typeof i.field, "unknown">>(i.field);
        });
      });

      describe("relation field", () => {
        it("should validate relation field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: "accounts" as const,
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<PromiseModel<typeof CustomAccount> | undefined>(i.field); // Check the field is a PromiseModel
        });
      });

      describe("date field", () => {
        it("should validate date field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.DATE,
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<Date | undefined>(i.field); // Check the field is a Date
        });
      });

      describe("integer field", () => {
        it("should validate integer field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.INTEGER,
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<number | undefined>(i.field); // Check the field is a number

          const json = i.toJSON();

          simulateTypeCheck<number | undefined>(json.field); // Check the field is a number
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });

      describe("enum field", () => {
        it("should validate enum field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.ENUM,
                  options: {
                    enum: ["a", "b", "c"] as const,
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | undefined>(i.field); // Check the field is a string

          const json = i.toJSON();

          simulateTypeCheck<string | undefined>(json.field); // Check the field is a string
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });
    });

    describe("test json", () => {
      describe("date field", () => {
        it("should validate date field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.DATE,
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<Date | undefined>(i.field); // Check the field is a string

          const json = i.toJSON();

          simulateTypeCheck<string | undefined>(json.field); // Check the field is a string
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });

      describe("relation field", () => {
        it("should validate relation field", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.RELATION,
                  options: {
                    ref: "accounts" as const,
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<PromiseModel<typeof CustomAccount> | undefined>(i.field);

          const json = i.toJSON();

          simulateTypeCheck<string | ModelJSON<typeof Account> | undefined>(json.field);
        });
      });

      describe("array field", () => {
        it("should validate array of relation", () => {
          class CustomModel extends Model {
            static definition = {
              fields: {
                field: {
                  type: FieldTypes.ARRAY,
                  options: {
                    items: { type: FieldTypes.TEXT },
                  },
                },
              },
            } as const satisfies ModelDefinition;
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string[] | undefined>(i.field); // Check the field is a string[]

          const json = i.toJSON();

          simulateTypeCheck<string[] | undefined>(json.field); // Check the field is a string[]
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });
    });
  });

  describe("generic model", () => {
    it("should validate relation field", () => {
      const i = (
        Model as typeof Model & {
          definition: {
            fields: {
              title: {
                type: FieldTypes.TEXT;
              };
              field: {
                type: FieldTypes.RELATION;
                options: {
                  ref: "accounts";
                };
              };
            };
          };
        }
      ).hydrate({
        title: "ok",
        field: "blabla",
      });

      simulateTypeCheck<string | undefined>(i.title); // Check the field is a PromiseModel
      simulateTypeCheck<PromiseModel<typeof CustomAccount> | undefined>(i.field); // Check the field is a PromiseModel

      const json = i.toJSON();

      simulateTypeCheck<string | ModelJSON<typeof Account> | undefined>(json.field); // Check the field is a string
      simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
    });
  });

  it("should ...", () => {
    const i = Role.hydrate();

    simulateTypeCheck<string | undefined>(i.slug); // Check the field is a string
    simulateTypeCheck<Function>(i.getRulesInherited); // Check the field is a string

    const json = i.toJSON();

    simulateTypeCheck<string | undefined>(json.slug); // Check the field is a string
  });

  it("should ...", () => {
    const model = Model.getClass<
      typeof Model & {
        definition: {
          fields: {
            field: {
              type: FieldTypes.TEXT;
            };
          };
        };
      }
    >("test");

    const i = model.hydrate();

    simulateTypeCheck<string | undefined>(i.field); // Check the field is a string
  });

  it("should ...", () => {
    const ModelFromSlug = Model.getClass("customModel");

    simulateTypeCheck<typeof CustomModel>(ModelFromSlug);

    const i = ModelFromSlug.hydrate();

    simulateTypeCheck<string | undefined>(i.field); // Check the field is a string
  });

  it("should ...", () => {
    const ModelFromSlug = Model.getClass("accounts");

    simulateTypeCheck<typeof CustomAccount>(ModelFromSlug);

    const i = ModelFromSlug.hydrate();

    simulateTypeCheck<PromiseModel<typeof Role> | undefined>(i.role); // Check the role has been inherited from Account
    simulateTypeCheck<string | undefined>(i.get("role", "json"));
    simulateTypeCheck<string | undefined>(i.foo); // Check the foo field is a string
  });

  it("should ...", () => {
    const i = (
      Model as typeof Model & {
        definition: {
          fields: {
            field1: {
              type: FieldTypes.TEXT;
            };
            field2: {
              type: FieldTypes.NUMBER;
            };
            rel: {
              type: FieldTypes.RELATION;
              options: {
                ref: "accounts";
              };
            };
          };
        };
      }
    ).hydrate();

    simulateTypeCheck<string | undefined>(i.get("field1", "json")); // Check the field is a string
    simulateTypeCheck<number | undefined>(i.get("field2", "json")); // Check the field is a string
  });

  it("should ...", () => {
    class RelatedModel extends Model {
      static slug = "related" as const;
      static definition = {
        fields: {
          field: {
            type: FieldTypes.NUMBER,
          },
        },
      } as const satisfies ModelDefinition;
    }

    class CustomModel extends Model {
      static slug = "custom" as const;
      static definition = {
        fields: {
          field1: {
            type: FieldTypes.TEXT,
          },
          field2: {
            type: FieldTypes.NUMBER,
          },
          rel: {
            type: FieldTypes.RELATION,
            options: {
              ref: RelatedModel.slug,
            },
          },
        },
      } as const satisfies ModelDefinition;
    }

    const i = CustomModel.hydrate();

    simulateTypeCheck<PromiseModel<typeof CustomModel> | undefined>(i.rel);
  });

  describe("hooks", () => {
    it("should validate before createOne hook data", () => {
      const hookData: HookData<"before", "createOne", typeof CustomModel> = {} as any;

      simulateTypeCheck<ModelJSON<typeof CustomModel>>(hookData.args?.[0]);
      simulateTypeCheck<undefined>(hookData.res);
    });
  });
});
