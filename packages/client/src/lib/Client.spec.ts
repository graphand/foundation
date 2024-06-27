import Client from "./Client";
import Module from "./Module";

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
});
