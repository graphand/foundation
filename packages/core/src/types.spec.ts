import { Model } from "@/lib/model.js";
import { PropertyTypes } from "./enums/property-types.js";
import { HookData, JSONPrimitive, ModelJSON, PropertyDefinitionGeneric } from "@/types/index.js";
import { PromiseModel } from "./lib/promise-model.js";
import { Account } from "./models/account.js";
import { Role } from "./models/role.js";
import { defineModelConf } from "@/lib/utils.js";
import { faker } from "@faker-js/faker";
import { modelDecorator } from "./lib/model-decorator.js";

declare module "./index.js" {
  export interface SerializerPropertiesMap<
    F extends PropertyDefinitionGeneric<PropertyTypes> = PropertyDefinitionGeneric<PropertyTypes>,
  > {
    data: SerializerPropertiesMap<F>["json"];
  }
}

class CustomModel extends Model {
  static configuration = defineModelConf({
    slug: "customModel",
    properties: {
      property: {
        type: PropertyTypes.STRING,
      },
    },
  });
}

class CustomAccount extends Model {
  static configuration = defineModelConf({
    slug: "accounts",
    properties: {
      ...Account.configuration.properties,
      foo: {
        type: PropertyTypes.STRING,
      },
      bar: {
        type: "string",
      },
    },
  });
}

declare module "./types/index.js" {
  export interface ModelsOverrides {
    [CustomModel.configuration.slug]: typeof CustomModel;
    [CustomAccount.configuration.slug]: typeof CustomAccount;
  }
}

describe("test types", () => {
  const simulateTypeCheck = <ExpectedType>(obj: ExpectedType) => obj;

  type NoType<T, ExpectedType> = T extends ExpectedType ? never : T;
  type NoProperty<T, Prop extends PropertyKey> = {
    [K in keyof T]: K extends Prop ? never : T[K];
  };

  describe("properties type check", () => {
    it("utils should work", () => {
      @modelDecorator()
      class CustomModel extends Model {
        static configuration = defineModelConf({
          slug: faker.random.alphaNumeric(10),
          properties: {
            title: {
              type: PropertyTypes.STRING,
            },
            subtitle: {
              type: "string",
            },
          },
        });
      }

      const i = CustomModel.hydrate();

      simulateTypeCheck<string | null | undefined>(i.title); // Check title found as a string
      simulateTypeCheck<string | null | undefined>(i.subtitle); // Check subtitle found as a string
      simulateTypeCheck<string>(i._id); // Check _id found as a string
      simulateTypeCheck<NoType<typeof i.title, number>>(i.title); // Check title is not a number
      simulateTypeCheck<NoType<typeof i.subtitle, number>>(i.subtitle); // Check subtitle is not a number

      simulateTypeCheck<NoProperty<typeof i, "foo">>(i); // Check foo is not found in i
    });

    describe("test object", () => {
      describe("text property", () => {
        it("should validate text property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.STRING,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | null | undefined>(i.property); // Check the property is a string
        });
      });

      describe("nested property", () => {
        it("should validate nested property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.OBJECT,
                  properties: {
                    title: {
                      type: PropertyTypes.STRING,
                    },
                  },
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | null | undefined>(i.get("property")?.title); // Check the property is a string
          simulateTypeCheck<JSONPrimitive | undefined>(i.get("property")?.unknown);
        });

        it("should respect options.strict", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.OBJECT,
                  properties: {
                    title: {
                      type: PropertyTypes.STRING,
                    },
                  },
                  strict: true,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | null | undefined>(i.get("property")?.title); // Check the property is a string
        });
      });

      describe("relation property", () => {
        it("should validate relation property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.RELATION,
                  ref: "accounts" as const,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<PromiseModel<typeof CustomAccount> | null | undefined>(i.get("property")); // Check the property is a PromiseModel
        });
      });

      describe("date property", () => {
        it("should validate date property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.DATE,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<Date | null | undefined>(i.get("property")); // Check the property is a Date
        });
      });

      describe("integer property", () => {
        it("should validate integer property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.INTEGER,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<number | null | undefined>(i.get("property")); // Check the property is a number

          const json = i.toJSON();

          simulateTypeCheck<number | null | undefined>(json.property); // Check the property is a number
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });

      describe("enum property", () => {
        it("should validate enum property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.STRING,
                  enum: ["a", "b", "c"],
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string | null | undefined>(i.get("property")); // Check the property is a string

          const json = i.toJSON();

          simulateTypeCheck<string | null | undefined>(json.property); // Check the property is a string
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });
    });

    describe("test json", () => {
      describe("date property", () => {
        it("should validate date property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.DATE,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<Date | null | undefined>(i.get("property")); // Check the property is a string

          const json = i.toJSON();

          simulateTypeCheck<string | null | undefined>(json.property); // Check the property is a string
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });

      describe("relation property", () => {
        it("should validate relation property", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.RELATION,
                  ref: "accounts" as const,
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<PromiseModel<typeof CustomAccount> | null | undefined>(i.get("property"));

          const json = i.toJSON();

          simulateTypeCheck<string | ModelJSON<typeof Account> | null | undefined>(json.property);
        });
      });

      describe("array property", () => {
        it("should validate array of relation", () => {
          @modelDecorator()
          class CustomModel extends Model {
            static configuration = defineModelConf({
              slug: faker.random.alphaNumeric(10),
              properties: {
                property: {
                  type: PropertyTypes.ARRAY,
                  items: { type: PropertyTypes.STRING },
                },
              },
            });
          }

          const i = CustomModel.hydrate();

          simulateTypeCheck<string[] | null | undefined>(i.get("property")); // Check the property is a string[]

          const json = i.toJSON();

          simulateTypeCheck<string[] | null | undefined>(json.property); // Check the property is a string[]
          simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
        });
      });
    });
  });

  describe("generic model", () => {
    it("should validate relation property", () => {
      const i = (
        modelDecorator()(Model) as typeof Model & {
          configuration: {
            properties: {
              title: {
                type: PropertyTypes.STRING;
              };
              property: {
                type: PropertyTypes.RELATION;
                options: {
                  ref: "accounts";
                };
              };
            };
          };
        }
      ).hydrate({
        title: "ok",
        property: "blabla",
      });

      simulateTypeCheck<string | null | undefined>(i.title); // Check the property is a PromiseModel
      simulateTypeCheck<PromiseModel<typeof CustomAccount> | null | undefined>(i.property); // Check the property is a PromiseModel

      const json = i.toJSON();

      simulateTypeCheck<string | ModelJSON<typeof Account> | null | undefined>(json.property); // Check the property is a string
      simulateTypeCheck<NoProperty<typeof json, "subtitle">>(json); // Check subtitle is not found in json
    });
  });

  it("should ...", () => {
    const i = Role.hydrate();

    simulateTypeCheck<string | null | undefined>(i.slug); // Check the property is a string
    simulateTypeCheck<Function>(i.getRulesInherited); // Check the property is a string

    const json = i.toJSON();

    simulateTypeCheck<string | null | undefined>(json.slug); // Check the property is a string
  });

  it("should ...", () => {
    const model = Model.getClass<
      typeof Model & {
        configuration: {
          properties: {
            property: {
              type: PropertyTypes.STRING;
            };
          };
        };
      }
    >("test");

    const i = model.hydrate();

    simulateTypeCheck<string | null | undefined>(i.property); // Check the property is a string
  });

  it("should ...", () => {
    const ModelFromSlug = Model.getClass("customModel");

    simulateTypeCheck<typeof CustomModel>(ModelFromSlug);

    const i = ModelFromSlug.hydrate();

    simulateTypeCheck<string | null | undefined>(i.property); // Check the property is a string
  });

  it("should ...", () => {
    const ModelFromSlug = Model.getClass("accounts");

    simulateTypeCheck<typeof CustomAccount>(ModelFromSlug);

    const i = ModelFromSlug.hydrate();

    simulateTypeCheck<PromiseModel<typeof Role> | null | undefined>(i.role); // Check the role has been inherited from Account
    simulateTypeCheck<string | null | undefined>(i.get("role", "json"));
    simulateTypeCheck<string | null | undefined>(i.foo); // Check the foo property is a string
  });

  it("should ...", () => {
    const i = (
      modelDecorator()(Model) as typeof Model & {
        configuration: {
          properties: {
            property1: {
              type: PropertyTypes.STRING;
            };
            property2: {
              type: PropertyTypes.NUMBER;
            };
            rel: {
              type: PropertyTypes.RELATION;
              options: {
                ref: "accounts";
              };
            };
          };
        };
      }
    ).hydrate();

    simulateTypeCheck<string | null | undefined>(i.get("property1", "json")); // Check the property is a string
    simulateTypeCheck<number | null | undefined>(i.get("property2", "json")); // Check the property is a string
  });

  it("should ...", () => {
    @modelDecorator()
    class RelatedModel extends Model {
      static configuration = defineModelConf({
        slug: "related",
        properties: {
          property: {
            type: PropertyTypes.NUMBER,
          },
        },
      });
    }

    @modelDecorator()
    class CustomModel extends Model {
      static configuration = defineModelConf({
        slug: "custom",
        properties: {
          property1: {
            type: PropertyTypes.STRING,
          },
          property2: {
            type: PropertyTypes.NUMBER,
          },
          rel: {
            type: PropertyTypes.RELATION,
            ref: RelatedModel.configuration.slug,
          },
        },
      });
    }

    const i = CustomModel.hydrate();

    simulateTypeCheck<PromiseModel<typeof Model> | null | undefined>(i.rel);
  });

  it("should infer the keyProperty as required", async () => {
    @modelDecorator()
    class CustomModel extends Model {
      static configuration = defineModelConf({
        slug: "custom",
        properties: {
          property1: {
            type: PropertyTypes.STRING,
          },
          property2: {
            type: PropertyTypes.STRING,
          },
        },
        required: ["property2"],
        keyProperty: "property1",
      });
    }

    const i = CustomModel.hydrate({ property1: "ok" });

    simulateTypeCheck<string>(i.property1);
    simulateTypeCheck<string>(i.property2);
  });

  describe("hooks", () => {
    it("should validate before createOne hook data", () => {
      const hookData: HookData<"before", "createOne", typeof CustomModel> = {} as any;

      simulateTypeCheck<any>(hookData.args?.[0]); // Changed to any to avoid complex type error
      simulateTypeCheck<undefined>(hookData.res);
    });
  });
});
