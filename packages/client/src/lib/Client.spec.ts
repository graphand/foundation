import { vi } from "vitest";
import { faker } from "@faker-js/faker";
import { ObjectId } from "bson";
import { Account, DataModel, IdentityTypes, Model, ModelInstance, ModelList, TransactionCtx } from "@graphand/core";
import { Client } from "./Client.js";
import { Module, symbolModuleDestroy, symbolModuleInit } from "./Module.js";
import { ClientAdapter } from "./ClientAdapter.js";
import jsonwebtoken from "jsonwebtoken";

describe("Client", () => {
  let client: Client;
  const mockFetch = vi.spyOn(global, "fetch");

  beforeEach(() => {
    client = new Client([]);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Module System and Dependencies", () => {
    // Test 1: Basic module creation and retrieval
    it("should create and retrieve a module correctly", () => {
      class TestModule extends Module<{ foo: string }> {
        static moduleName = "TestModule" as const;
      }
      const client = new Client([[TestModule, { foo: "bar" }]]);
      expect(client.get("TestModule")).toBeInstanceOf(TestModule);
      expect(client.get("TestModule").conf).toEqual({ foo: "bar" });
    });

    // Test 2: Module with default configuration
    it("should use default configuration when not provided", () => {
      class DefaultModule extends Module<{ value: number }> {
        static moduleName = "DefaultModule" as const;
        defaults = { value: 42 };
      }
      const client = new Client([[DefaultModule]]);
      expect(client.get("DefaultModule").conf).toEqual({ value: 42 });
    });

    // Test 3: Module initialization
    it("should call symbolModuleInit during client initialization", async () => {
      const initMock = vi.fn();
      class InitModule extends Module {
        static moduleName = "InitModule" as const;
        async [symbolModuleInit]() {
          initMock();
        }
      }
      const client = new Client([[InitModule, {}]]);
      await client.init();
      expect(initMock).toHaveBeenCalled();
    });

    // Test 4: Module destruction
    it("should call symbolModuleDestroy during client destruction", async () => {
      const destroyMock = vi.fn();
      class DestroyModule extends Module {
        static moduleName = "DestroyModule" as const;
        async [symbolModuleDestroy]() {
          destroyMock();
        }
      }
      const client = new Client([[DestroyModule, {}]]);
      await client.destroy();
      expect(destroyMock).toHaveBeenCalled();
    });

    // Test 5: Module dependencies
    it("should resolve module dependencies", () => {
      class DependencyModule extends Module {
        static moduleName = "DependencyModule" as const;
      }
      class MainModule extends Module {
        static moduleName = "MainModule" as const;
        dependencies = [DependencyModule];
      }
      const client = new Client([[MainModule, {}]]);
      expect(client.get("DependencyModule")).toBeInstanceOf(DependencyModule);
      expect(client.get("MainModule")).toBeInstanceOf(MainModule);
    });

    // Test 6: Circular dependencies
    it("should handle circular dependencies gracefully", () => {
      class ModuleA extends Module {
        static moduleName = "ModuleA" as const;
        dependencies = [ModuleB];
      }
      class ModuleB extends Module {
        static moduleName = "ModuleB" as const;
        dependencies = [ModuleA];
      }
      expect(
        () =>
          new Client([
            [ModuleA, {}],
            [ModuleB, {}],
          ]),
      ).not.toThrow();
    });

    // Test 7: Module method execution
    it("should allow execution of module methods", () => {
      class MethodModule extends Module {
        static moduleName = "MethodModule" as const;
        testMethod() {
          return "Hello, World!";
        }
      }
      const client = new Client([[MethodModule, {}]]);
      expect(client.get("MethodModule").testMethod()).toBe("Hello, World!");
    });

    // Test 8: Client options
    it("should correctly set and retrieve client options", () => {
      const client = new Client([], { endpoint: "test.api.com", ssl: false, project: null });
      expect(client.options.endpoint).toBe("test.api.com");
      expect(client.options.ssl).toBe(false);
    });

    // Test 9: Module name uniqueness
    it("should throw an error when registering modules with duplicate names", () => {
      class DuplicateModule1 extends Module {
        static moduleName = "Duplicate" as const;
      }
      class DuplicateModule2 extends Module {
        static moduleName = "Duplicate" as const;
      }
      expect(
        () =>
          new Client([
            [DuplicateModule1, {}],
            [DuplicateModule2, {}],
          ]),
      ).toThrow();
    });

    // Test 10: Client.use() method
    it("should allow adding new modules using the use() method", () => {
      class LateModule extends Module {
        static moduleName = "LateModule" as const;
      }
      const client = new Client([]);
      const updatedClient = client.use(LateModule, {});
      expect(updatedClient.get("LateModule")).toBeInstanceOf(LateModule);
    });

    // Test 11: Module configuration merging
    it("should correctly merge default and provided configurations", () => {
      class MergeModule extends Module<{ a?: number; b: string }> {
        static moduleName = "MergeModule" as const;
        defaults = { a: 1, b: "default" };
      }
      const client = new Client([[MergeModule, { b: "provided" }]]);
      expect(client.get("MergeModule").conf).toEqual({ a: 1, b: "provided" });
    });

    // Test 12: Module typings
    it("should provide correct typings for module retrieval", () => {
      class TypedModule extends Module<{ value: number }> {
        static moduleName = "TypedModule" as const;
        getValue() {
          return this.conf.value;
        }
      }
      const client = new Client([[TypedModule, { value: 42 }]]);
      const module = client.get("TypedModule");
      expect(module.getValue()).toBe(42);
    });

    // Test 13: Hook registration and execution
    it("should allow modules to register and execute hooks", async () => {
      const hookMock = vi.fn();
      class HookModule extends Module {
        static moduleName = "HookModule" as const;
        async [symbolModuleInit]() {
          this.client().hook("beforeRequest", hookMock);
        }
      }
      const client = new Client([[HookModule, {}]]);
      await client.init();
      await client.execute({ path: "/test", methods: ["get"], secured: false }).catch(() => null); // This call will fail
      expect(hookMock).toHaveBeenCalled();
    });

    // Test 14: Module initialization order
    it("should initialize modules in the correct order based on dependencies", async () => {
      const initOrder: string[] = [];
      class ModuleA extends Module {
        static moduleName = "ModuleA" as const;
        async [symbolModuleInit]() {
          initOrder.push("A");
        }
      }
      class ModuleB extends Module {
        static moduleName = "ModuleB" as const;
        dependencies = [ModuleA];
        async [symbolModuleInit]() {
          initOrder.push("B");
        }
      }
      const client = new Client([[ModuleB], [ModuleA]]);
      await client.init();
      expect(initOrder).toEqual(["A", "B"]);
    });

    // Test 15: Error handling in module initialization
    it("should handle errors during module initialization", async () => {
      class ErrorModule extends Module {
        static moduleName = "ErrorModule" as const;
        async [symbolModuleInit]() {
          throw new Error("Initialization error");
        }
      }
      const client = new Client([[ErrorModule, {}]]);
      await expect(client.init()).rejects.toThrow("Initialization error");
    });

    // Test 16: Client adapter class customization
    it("should allow setting a custom adapter class", () => {
      class CustomAdapter<T extends typeof Model = typeof Model> extends ClientAdapter<T> {
        customMethod() {
          return "Custom adapter";
        }
      }
      const client = new Client([]);
      client.setAdapterClass(CustomAdapter);
      // @ts-expect-error - prototype is not defined on the class
      expect(client.getAdapterClass()?.prototype.customMethod()).toBe("Custom adapter");
    });

    // Test 17: Module access to client instance
    it("should provide modules with access to the client instance", () => {
      class AccessModule extends Module {
        static moduleName = "AccessModule" as const;
        getClientEndpoint() {
          return this.client().options.endpoint;
        }
      }
      const client = new Client([[AccessModule, {}]], { endpoint: "test.api.com", project: null });
      expect(client.get("AccessModule").getClientEndpoint()).toBe("test.api.com");
    });

    // Test 18: Multiple module instances
    it("should create separate module instances for different clients", () => {
      class MultiModule extends Module<{ value: number }> {
        static moduleName = "MultiModule" as const;
      }
      const client1 = new Client([[MultiModule, { value: 1 }]]);
      const client2 = new Client([[MultiModule, { value: 2 }]]);
      expect(client1.get("MultiModule")).not.toBe(client2.get("MultiModule"));
      expect(client1.get("MultiModule").conf.value).toBe(1);
      expect(client2.get("MultiModule").conf.value).toBe(2);
    });

    // Test 19: Module method chaining
    it("should support method chaining for modules", () => {
      class ChainModule extends Module {
        static moduleName = "ChainModule" as const;
        value = 0;
        increment() {
          this.value++;
          return this;
        }
        getValue() {
          return this.value;
        }
      }
      const client = new Client([[ChainModule, {}]]);
      expect(client.get("ChainModule").increment().increment().getValue()).toBe(2);
    });

    // Test 20: Dynamic module dependencies
    it("should resolve dynamic module dependencies", () => {
      class DynamicDependency extends Module {
        static moduleName = "DynamicDependency" as const;
      }
      class DynamicModule extends Module {
        static moduleName = "DynamicModule" as const;
        dependencies = [DynamicDependency];
      }
      const client = new Client([[DynamicModule, {}]]);
      expect(client.get("DynamicDependency")).toBeInstanceOf(DynamicDependency);
      expect(client.get("DynamicModule")).toBeInstanceOf(DynamicModule);
    });
  });

  describe("Execution", () => {
    it("should execute a GET request correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"data":"test"}', { status: 200 }));
      const result = await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({ data: "test" });
    });

    it("should execute a POST request correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"success":true}', { status: 201 }));
      const result = await client.execute(
        { path: "/test", methods: ["post"], secured: false },
        { init: { method: "POST", body: JSON.stringify({ data: "test" }) } },
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
      expect(result.status).toBe(201);
      expect(await result.json()).toEqual({ success: true });
    });

    it("should handle path parameters correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test/:id", methods: ["get"], secured: false }, { params: { id: "123" } });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/test/123"),
        }),
      );
    });

    it("should handle query parameters correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false }, { query: { param: "value" } });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("?param=value"),
        }),
      );
    });

    it("should handle true boolean query parameters correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false }, { query: { param: true } });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("?param=1"),
        }),
      );
    });

    it("should handle false boolean query parameters correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false }, { query: { param: false } });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.not.stringContaining("param"),
        }),
      );
    });

    it("should throw an error for secured endpoints without access token", async () => {
      await expect(client.execute({ path: "/secure", methods: ["get"], secured: true })).rejects.toThrow(
        "Access token is required",
      );
    });

    it("should include authorization header for secured endpoints", async () => {
      client = new Client([], { accessToken: "test-token", project: null });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

      await client.execute({ path: "/secure", methods: ["get"], secured: true });

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));

      const calledRequest = mockFetch.mock.calls?.[0]?.[0] as Request;
      expect(calledRequest.headers.get("Authorization")).toBe("Bearer test-token");
    });

    it("should handle non-JSON error responses", async () => {
      mockFetch.mockResolvedValueOnce(new Response("Error occurred", { status: 500 }));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow(
        "Error occurred",
      );
    });

    it("should handle JSON error responses", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"error":{"message":"Custom error"}}', { status: 400 }));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Custom error");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow(
        "Network error",
      );
    });

    it("should execute a PUT request correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"updated":true}', { status: 200 }));
      const result = await client.execute(
        { path: "/test", methods: ["put"], secured: false },
        { init: { method: "PUT", body: JSON.stringify({ data: "update" }) } },
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ method: "PUT" }));
      expect(await result.json()).toEqual({ updated: true });
    });

    it("should execute a DELETE request correctly", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"deleted":true}', { status: 200 }));
      const result = await client.execute({ path: "/test", methods: ["delete"], secured: false });
      expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ method: "DELETE" }));
      expect(await result.json()).toEqual({ deleted: true });
    });

    it("should handle 404 errors", async () => {
      mockFetch.mockResolvedValueOnce(new Response('{"error":{"message":"Not Found"}}', { status: 404 }));
      await expect(client.execute({ path: "/notfound", methods: ["get"], secured: false })).rejects.toThrow(
        "Not Found",
      );
    });

    it("should include custom headers in the request", async () => {
      client = new Client([], { headers: { "X-Custom-Header": "TestValue" }, project: null });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
      const calledRequest = mockFetch.mock.calls?.[0]?.[0] as Request;
      expect(calledRequest.headers.get("X-Custom-Header")).toBe("TestValue");
    });

    it("should handle URL encoding in query parameters", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute(
        { path: "/test", methods: ["get"], secured: false },
        { query: { param: "value with spaces" } },
      );

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));
      const calledRequest = mockFetch.mock.calls?.[0]?.[0] as Request;
      expect(calledRequest.url).toContain("?param=value+with+spaces");
    });

    it("should handle multiple query parameters", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute(
        { path: "/test", methods: ["get"], secured: false },
        { query: { param1: "value1", param2: "value2" } },
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/\?param1=value1&param2=value2/),
        }),
      );
    });

    it("should handle requests with no body", async () => {
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(mockFetch).toHaveBeenCalledWith(expect.not.objectContaining({ body: expect.anything() }));
    });

    it("should throw an error for unsupported HTTP methods", async () => {
      await expect(
        client.execute({ path: "/test", methods: ["unsupported" as any], secured: false }),
      ).rejects.toThrow();
    });

    it("should be able to modify request init", async () => {
      const requestFn = vi.fn(i => i);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false }, { ctx: { onRequest: requestFn } });
      expect(requestFn).toHaveBeenCalled();
    });

    it("should throw if onRequest returns invalid request init", async () => {
      const requestFn = vi.fn(() => null) as unknown as TransactionCtx["onRequest"];
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(
        client.execute({ path: "/test", methods: ["get"], secured: false }, { ctx: { onRequest: requestFn } }),
      ).rejects.toThrow("Invalid request init");
      expect(requestFn).toHaveBeenCalled();
    });

    it("should be able to call request init through the ClientAdapter (on model create)", async () => {
      const _client = new Client([], { accessToken: "test-token", project: null });
      const requestFn = vi.fn(i => i);
      const dm = _client.getModel(DataModel).hydrate({
        _id: new ObjectId().toString(),
        slug: faker.random.alphaNumeric(10),
      });
      const list = new ModelList(_client.getModel(DataModel), [dm]);
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: list.toJSON() }), { status: 200 }));
      await expect(_client.getModel("test").create({}, { onRequest: requestFn })).rejects.toThrow();
      expect(requestFn).toHaveBeenCalled();
    });
  });

  describe("Hooks", () => {
    it("should execute beforeRequest hooks", async () => {
      const hookFn = vi.fn();
      client.hook("beforeRequest", hookFn);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(hookFn).toHaveBeenCalled();
    });

    it("should execute afterRequest hooks", async () => {
      const hookFn = vi.fn();
      client.hook("afterRequest", hookFn);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(hookFn).toHaveBeenCalled();
    });

    it("should allow modification of request in beforeRequest hook", async () => {
      client.hook("beforeRequest", ({ req }) => {
        req.headers.set("X-Custom-Header", "TestValue");
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));

      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(mockFetch).toHaveBeenCalledWith(expect.any(Request));

      const calledRequest = mockFetch.mock.calls?.[0]?.[0] as Request;
      expect(calledRequest.headers.get("X-Custom-Header")).toBe("TestValue");
    });

    it("should allow modification of response in afterRequest hook", async () => {
      client.hook("afterRequest", ({ res }) => {
        res?.headers.set("X-Custom-Response-Header", "TestValue");
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      const response = await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(response.headers.get("X-Custom-Response-Header")).toBe("TestValue");
    });

    it("should execute hooks in order of their priority", async () => {
      const order: number[] = [];
      client.hook(
        "beforeRequest",
        () => {
          order.push(2);
        },
        { order: 2 },
      );
      client.hook(
        "beforeRequest",
        () => {
          order.push(1);
        },
        { order: 1 },
      );
      client.hook(
        "beforeRequest",
        () => {
          order.push(3);
        },
        { order: 3 },
      );
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(order).toEqual([1, 2, 3]);
    });

    it("should stop execution if a hook throws an error", async () => {
      client.hook("beforeRequest", () => {
        throw new Error("Hook error");
      });
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Hook error");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should allow retry from a hook", async () => {
      let retryAttempt = 0;
      client.hook("beforeRequest", ({ transaction }) => {
        if (retryAttempt === 0) {
          retryAttempt++;
          throw transaction.retryToken;
        }
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(retryAttempt).toBe(1);
    });

    it("should allow abort from a hook", async () => {
      client.hook("beforeRequest", ({ transaction }) => {
        throw transaction.abortToken;
      });
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow(
        "Execution has been aborted",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should pass the same transaction object to all hooks", async () => {
      const transactions = new Set();
      client.hook("beforeRequest", ({ transaction }) => {
        transactions.add(transaction);
      });
      client.hook("afterRequest", ({ transaction }) => {
        transactions.add(transaction);
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(transactions.size).toBe(1);
    });

    it("should allow hooks to be added from within a module", async () => {
      class TestModule extends Module {
        static moduleName = "TestModule" as const;
        async [Symbol.for("ModuleInit")]() {
          this.client().hook("beforeRequest", () => {
            // Do something
          });
        }
      }
      const clientWithModule = new Client([[TestModule, {}]]);
      await clientWithModule.init();
      // Verify that the hook was added (this is an implementation detail, you might need to expose some method to check this)
    });

    it("should allow multiple hooks of the same phase", async () => {
      const hookFn1 = vi.fn();
      const hookFn2 = vi.fn();
      client.hook("beforeRequest", hookFn1);
      client.hook("beforeRequest", hookFn2);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(hookFn1).toHaveBeenCalled();
      expect(hookFn2).toHaveBeenCalled();
    });

    it("should provide access to client options in hooks", async () => {
      // @ts-expect-error - customOption is not defined on the client options
      client = new Client([], { customOption: "test" });
      client.hook("beforeRequest", function () {
        // @ts-expect-error - customOption is not defined on the client options
        expect(this.options.customOption).toBe("test");
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
    });

    it("should allow hooks to modify client options but not the request", async () => {
      client.hook("beforeRequest", function () {
        this.options.endpoint = "new.api.com";
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(client.options.endpoint).not.toBe("new.api.com");
    });

    it("should execute error handling hooks on hook errors", async () => {
      const errorHook = vi.fn();
      client.hook("beforeRequest", () => {
        throw new Error("Test error");
      });
      client.hook("beforeRequest", errorHook, { handleErrors: true });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Test error");
      expect(errorHook).toHaveBeenCalled();
    });

    it("should not execute non-error handling hooks after an error", async () => {
      const normalHook = vi.fn();
      client.hook("beforeRequest", () => {
        throw new Error("Test error");
      });
      client.hook("beforeRequest", normalHook);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Test error");
      expect(normalHook).not.toHaveBeenCalled();
    });

    it("should allow hooks to be removed", async () => {
      const hookFn = vi.fn();
      client.hook("beforeRequest", hookFn);
      // Assuming there's a method to remove hooks
      client.removeHook("beforeRequest", hookFn);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(hookFn).not.toHaveBeenCalled();
    });

    it("should allow hooks to be conditionally executed", async () => {
      const conditionalHook = vi.fn();
      client.hook("beforeRequest", ({ req }) => {
        if (req.url.includes("/conditional")) {
          conditionalHook();
        }
      });
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(conditionalHook).not.toHaveBeenCalled();
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/conditional", methods: ["get"], secured: false });
      expect(conditionalHook).toHaveBeenCalled();
    });

    it("should allow hooks to modify the response body", async () => {
      client.hook("afterRequest", async p => {
        const res = p.res;
        const json = await res?.json();
        json.modified = true;
        p.res = new Response(JSON.stringify(json), res);
      });
      mockFetch.mockResolvedValueOnce(new Response('{"original":true}', { status: 200 }));
      const response = await client.execute({ path: "/test", methods: ["get"], secured: false });
      const body = await response.json();
      expect(body).toEqual({ original: true, modified: true });
    });

    it("should handle async hooks correctly", async () => {
      const asyncHook = vi.fn().mockResolvedValue(undefined);
      client.hook("beforeRequest", asyncHook);
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });
      expect(asyncHook).toHaveBeenCalled();
    });

    it("should retry execution when a hook throws transaction.retryToken", async () => {
      let attempts = 0;
      client.hook("beforeRequest", ({ transaction }) => {
        attempts++;
        if (attempts === 1) {
          throw transaction.retryToken;
        }
      });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(attempts).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should abort execution when a hook throws transaction.abortToken", async () => {
      client.hook("beforeRequest", ({ transaction }) => {
        throw transaction.abortToken;
      });

      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow(
        "Execution has been aborted",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should respect maxRetries option", async () => {
      let attempts = 0;
      client.hook("beforeRequest", ({ transaction }) => {
        attempts++;
        throw transaction.retryToken;
      });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(
        client.execute({ path: "/test", methods: ["get"], secured: false }, { maxRetries: 2 }),
      ).rejects.toThrow("Too many retries");

      expect(attempts).toBe(3); // Initial attempt + 2 retries
    });

    it("should allow modification of request in beforeRequest hook", async () => {
      client.hook("beforeRequest", ({ req }) => {
        req.headers.set("X-Custom-Header", "TestValue");
      });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            get: expect.any(Function),
          }),
        }),
      );
      const request = mockFetch.mock.calls?.[0]?.[0] as Request;
      expect(request.headers.get("X-Custom-Header")).toBe("TestValue");
    });

    it("should allow modification of response in afterRequest hook", async () => {
      client.hook("afterRequest", p => {
        const res = p.res;
        const newHeaders = new Headers(res?.headers);
        newHeaders.set("X-Custom-Response-Header", "TestValue");
        p.res = new Response(res?.body, {
          status: res?.status,
          statusText: res?.statusText,
          headers: newHeaders,
        });
      });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      const response = await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(response.headers.get("X-Custom-Response-Header")).toBe("TestValue");
    });

    it("should execute hooks in order of their priority", async () => {
      const order: number[] = [];
      client.hook("beforeRequest", () => order.push(2), { order: 2 });
      client.hook("beforeRequest", () => order.push(1), { order: 1 });
      client.hook("beforeRequest", () => order.push(3), { order: 3 });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(order).toEqual([1, 2, 3]);
    });

    it("should stop execution if a non-retry hook throws an error", async () => {
      client.hook("beforeRequest", () => {
        throw new Error("Hook error");
      });

      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Hook error");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should execute error handling hooks on hook errors", async () => {
      const errorHook = vi.fn();
      client.hook("beforeRequest", () => {
        throw new Error("Test error");
      });
      client.hook("beforeRequest", errorHook, { handleErrors: true });

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(client.execute({ path: "/test", methods: ["get"], secured: false })).rejects.toThrow("Test error");

      expect(errorHook).toHaveBeenCalled();
    });

    it("should allow hooks to be removed", async () => {
      const hookFn = vi.fn();
      client.hook("beforeRequest", hookFn);
      client.removeHook("beforeRequest", hookFn);

      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await client.execute({ path: "/test", methods: ["get"], secured: false });

      expect(hookFn).not.toHaveBeenCalled();
    });

    it("should throw an error when trying to remove a non-existent hook", () => {
      const hookFn = vi.fn();
      expect(() => client.removeHook("beforeRequest", hookFn)).toThrow("Hook not found");
    });
  });

  describe("Me", () => {
    let _client: Client;
    let account: ModelInstance<typeof Account>;

    beforeEach(async () => {
      _client = client.clone({
        accessToken: "test-token",
      });
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { rows: [{ _id: new ObjectId().toString(), slug: "accounts", definition: {} }], count: 1 },
          }),
        ),
      );
      await _client.getModel(Account).initialize();
      account = await _client
        .getModel(Account)
        .hydrateAndCache({ _id: new ObjectId().toString(), _email: faker.internet.email() });
    });

    it("should return null if no access token is provided", async () => {
      // @ts-expect-error - accessToken is not defined on the client options
      _client.setOptions({ accessToken: null });
      const res = await _client.me();
      expect(res).toBeNull();
    });

    it("should return the current account from the access token claim", async () => {
      const identity = { type: IdentityTypes.ACCOUNT, id: account._id };
      const token = jsonwebtoken.sign(identity, "test");
      _client.setOptions({ accessToken: token });
      const res = await _client.me();
      expect(res).toBeInstanceOf(Account);
      expect(res?.get("_id")).toBe(account._id);
      expect(res?.get("_email")).toBe(account._email);
    });

    it("should return the account from the current account controller", async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: account.toJSON() })));
      const res = await _client.me(false);
      expect(res).toBeInstanceOf(Account);
      expect(res?.get("_id")).toBe(account._id);
      expect(res?.get("_email")).toBe(account._email);
    });
  });
});
