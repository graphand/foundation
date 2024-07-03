require("dotenv").config({ path: ".env.test.local" });
import { DataModel, FieldTypes, Model, ValidationError, controllersMap } from "@graphand/core";
import Client from "./Client";
import Module, { symbolModuleInit } from "./Module";

// Test cases
describe("Client", () => {
  it("should ...", () => {
    class TestModule extends Module<{ foo: string }> {
      static moduleName = "TestModule" as const;

      sayHello() {
        console.log("Hello from TestModule");
        return true;
      }
    }

    class TestModule2 extends Module<{ bar: string }> {
      static moduleName = "TestModule2" as const;

      sayGoodbye() {
        console.log("Goodbye from TestModule2");
        return true;
      }
    }

    const client = new Client([
      [TestModule, { foo: "123" }],
      [TestModule2, { bar: "123" }],
    ]);

    client.get("TestModule2").sayGoodbye();
    client.get("TestModule").sayHello();
    client.get<TestModule2>("blabla").sayGoodbye();

    const client2 = new Client([[TestModule, { foo: "123" }]]);

    // client2.get("TestModule2").sayGoodbye(); // Should throw an error

    const client3 = client2.use(TestModule2, { bar: "123" });

    client3.get("TestModule2").sayGoodbye();
  });

  it("should type check module declarations", () => {
    class TestModule extends Module<{ foo: string }> {}
    class TestModule2 extends Module<{ bar: string }> {}

    // Correctly typed client instantiation
    const client = new Client([
      [TestModule, { foo: "123" }],
      [TestModule2, { bar: "456" }],
    ]);

    // This should now cause a TypeScript error
    const clientWithError = new Client([
      //   [TestModule, { foo: 123 }], // TypeScript should detect this error
      [TestModule, { foo: "123" }],
      [TestModule2, { bar: "456" }],
      //   [TestModule2, { foor: "" }], // TypeScript should detect this error
    ]);
  });

  it("should ...", async () => {
    class AccessModule extends Module<{ accessKey: string }> {
      static moduleName = "AccessModule" as const;

      async [symbolModuleInit]() {
        this.client().hook("beforeRequest", ({ req }) => {
          req.headers.set("X-Access-Key", this.conf.accessKey);
        });
      }
    }

    const client = new Client([[AccessModule, { accessKey: "test123" }]]);

    const res = await client.execute(controllersMap.openapi);

    console.log(res);
  });

  it.only("should ...", async () => {
    class Module1 extends Module<{ foo: string }> {
      static moduleName = "module1" as const;

      async [symbolModuleInit]() {}

      m1() {
        return 1;
      }
    }

    class Module3 extends Module<{ bar: string }> {
      static moduleName = "module3" as const;

      async [symbolModuleInit]() {}

      m3() {
        return 3;
      }
    }

    class Module4 extends Module<{ bar: string }> {
      static moduleName = "module4" as const;

      async [symbolModuleInit]() {}

      m4() {
        return 4;
      }
    }

    class Module2 extends Module<{ bar?: string }> {
      static moduleName = "module2" as const;
      defaults = { bar: "123" };
      dependencies = [Module3, Module4];

      async [symbolModuleInit]() {
        // console.log(this.client().get("module3").m3());
        // console.log(this.client().get("module4").m4());
      }

      m2() {
        return 2;
      }
    }

    const client = new Client([
      [Module1, { foo: "123" }],
      [Module2, { bar: "123" }],
    ]);

    console.log(client.get("module2").conf);

    console.log(client.get("module1").m1());
    console.log(client.get("module2").m2());
    console.log(client.get(Module2).m2());

    await client.destroy();
  });

  it("should ...", async () => {
    const project = process.env.PROJECT || null;
    const accessKey = process.env.ACCESS_KEY;
    const token = process.env.TOKEN;

    const client = new Client([], {
      project,
      headers: {
        "X-Access-Key": String(accessKey),
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(client.getModel(DataModel).create({})).rejects.toThrow(ValidationError);
  });

  it("should ...", async () => {
    const project = process.env.PROJECT || null;
    const accessKey = process.env.ACCESS_KEY;
    const token = process.env.TOKEN;

    const client = new Client([], {
      project,
      headers: {
        "X-Access-Key": String(accessKey),
        Authorization: `Bearer ${token}`,
      },
    });

    const dm = await client.getModel(DataModel).create({
      slug: "todo2",
      definition: {
        fields: {
          title: {
            type: FieldTypes.TEXT,
          },
        },
      },
    });

    const model = client.getModel(dm) as typeof Model & {
      definition: {
        fields: {
          title: {
            type: FieldTypes.TEXT;
          };
        };
      };
    };

    await model.createMultiple([
      {
        title: "test1",
      },
      {
        title: "test2",
      },
      {
        title: "test3",
      },
    ]);

    const updated = await model.update(
      {
        filter: {
          title: "test1",
        },
      },
      {
        $set: {
          title: "test1-updated",
        },
      },
    );

    console.log(updated);

    const list = await model.getList({
      filter: {
        title: { $regex: "test" },
      },
    });

    console.log(list?.toJSON());

    const ids = list.toArray().map(item => item._id) as string[];

    const deleted = await model.delete({ ids: ids.slice(0, 2) });

    console.log(deleted);

    const count = await model.count();

    console.log(count);

    await dm.delete();
  });
});
