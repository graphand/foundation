import { Model } from "@/lib/model.js";
import { InferGDXDatamodels } from "./gdx.js";
import { InferModelDef, InferModelDefInput, InferModelDefInputWithoutKey } from "./properties.js";
import { defineGDX } from "@/lib/utils.js";
import { ObjectId } from "bson";
import { InferModelConfigurationFromDatamodel } from "./helpers.js";

describe("defineGDX", () => {
  it("should work with a simple gdx", () => {
    defineGDX({
      datamodels: {
        todo: {
          single: false,
          keyProperty: "title",
          properties: {
            title: {
              type: "string",
            },
            done: {
              type: "boolean",
              default: true,
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
            },
            subTodos: {
              type: "array",
              items: {
                type: "relation",
                ref: "todo",
              },
            },
            nested: {
              type: "object",
              properties: {
                nestedProperty: {
                  type: "string",
                },
              },
              validators: [
                {
                  type: "required",
                  property: "nestedProperty",
                },
                {
                  type: "unique",
                  property: "nestedProperty",
                },
              ],
            },
          },
        },
        homepage: {
          single: true,
          properties: {
            title: {
              type: "string",
            },
            subtitle: {
              type: "string",
            },
          },
        },
      },
      homepage: {
        title: "Welcome to the homepage",
        subtitle: "This is the homepage",
      },
      roles: {
        user: {
          rules: [
            {
              ref: "todo",
              actions: ["create", "update", "delete"],
            },
            {
              ref: "todo",
              actions: ["read"],
            },
            {
              ref: "todo",
              actions: ["read"],
              filter: {
                title: {
                  $regex: "a",
                },
              },
            },
            {
              ref: "homepage",
              actions: ["read", "update"],
            },
          ],
        },
      },
      tokenIssuers: {
        public: {
          role: "ref:user",
        },
      },
      todo: {
        todo1: {
          done: true,
        },
      },
    });
  });

  it("should detect missing required fields", () => {
    const gdx = defineGDX({
      datamodels: {
        list: {
          single: false,
          keyProperty: "title",
          properties: {
            title: {
              type: "string",
            },
            subtitle: {
              type: "string",
            },
          },
          required: ["subtitle", "title"],
        },
        page: {
          single: true,
          properties: {
            title: {
              type: "string",
            },
            subtitle: {
              type: "string",
            },
          },
          required: ["title"],
        },
      },
      list: {
        item1: {
          subtitle: "title",
        },
        // @ts-expect-error missing subtitle
        item2: {},
      },
      // @ts-expect-error missing title
      page: {},
    });

    type Conf = InferModelConfigurationFromDatamodel<"list", InferGDXDatamodels<typeof gdx>["list"]>;

    type TYPE_LIST = InferModelDef<typeof Model & { configuration: Conf }, "json">;

    type TYPE_LIST_INPUT = InferModelDefInput<typeof Model & { configuration: Conf }, "json">;

    type TYPE_LIST_INPUT_GDX = InferModelDefInputWithoutKey<typeof Model & { configuration: Conf }, "json">;
  });

  it("should work without datamodels", () => {
    defineGDX<{}>({
      roles: {
        role1: {
          rules: [
            {
              ref: "todo",
              // @ts-expect-error invalid
              actions: ["invalid"],
            },
          ],
        },
        role2: {},
      },
      foo: {
        bar: {
          title: "test",
        },
        baz: {
          title: "test",
        },
      },
    });

    defineGDX({
      roles: {
        public: {},
      },
      authProviders: {
        local: {
          register: {
            enabled: true,
            role: "ref:public",
          },
        },
      },
    });
  });

  it("should work with accounts", () => {
    defineGDX({
      accounts: {
        [new ObjectId().toString()]: {
          role: "ref:admin",
          _email: "test@test.com",
        },
      },
    });

    defineGDX({
      datamodels: {},
      list: {
        item1: {
          title: "test",
          rel: "ref:item2",
        },
        item2: {
          title: "test",
          rel: "ref:item1",
        },
      },
    });
  });
});
