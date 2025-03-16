import { AuthProviders } from "@/enums/auth-providers.js";
import { AuthProvider } from "./auth-provider.js";
import { mockAdapter } from "@/lib/test-utils.dev.js";

describe("EventSubscription Model", () => {
  const adapter = mockAdapter();
  const AuthProviderModel = AuthProvider.extend({ adapterClass: adapter });

  it("should be able to create a simple auth provider", async () => {
    await expect(
      AuthProviderModel.create({
        type: AuthProviders.LOCAL,
        options: {
          confirmEmail: true,
        },
        register: {
          enabled: true,
          authorizedProperties: ["firstname", "lastname"],
        },
      }),
    ).resolves.toBeInstanceOf(AuthProvider);
  });
});
