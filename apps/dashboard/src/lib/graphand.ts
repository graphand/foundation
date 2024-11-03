import { Client } from "@graphand/client";
import { cache } from "react";
import { ModuleAuth } from "@graphand/client-module-auth";

// Client-side singleton
let clientInstance: Client | null = null;

// declare class MemoryStorage implements AuthStorage {
//     private store;
//     setItem(key: string, value: string): void;
//     getItem(key: string): string | null;
//     removeItem(key: string): void;
// }
// type ModuleAuthOptions = {
//     autoRefreshToken?: boolean;
//     storage?: AuthStorage;
//     storagePrefix?: string;
//     getRedirectUrl?: () => string | URL | Promise<string | URL>;
//     handleCallback?: AuthCallbackHandler;
//     handleAccessToken?: (_accessToken: string | undefined) => void;
//     handleRedirectUrl?: {
//         url: string | URL | Promise<string | URL>;
//         onSuccess?: (_url: URL) => void;
//         onError?: (_error: Error) => void;
//     };
// };
// type AuthResult = {
//     action: "login" | "register";
//     account: ModelJSON<typeof Account>;
//     accessToken: string;
//     refreshToken: string;
// } | {
//     url: string;
// };
// declare class ModuleAuth extends Module<ModuleAuthOptions> {
//     #private;
//     static moduleName: "auth";
//     defaults: {
//         storage: MemoryStorage;
//         autoRefreshToken: boolean;
//     };
//     get storage(): AuthStorage | undefined;
//     [symbolModuleInit](): Promise<void>;
//     [symbolModuleDestroy](): Promise<void>;
//     getStoragePrefix(): string;
//     getStorageKey(key: string): string;
//     setTokens(accessToken: string, refreshToken: string): Promise<void>;
//     login<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(providerOrData: LoginData<P, M> | P, methodOrData?: Omit<LoginData<P, M>, "provider"> | M, _data?: Omit<LoginData<P, M>, "provider" | "method">, _query?: Record<string, string>): Promise<import('@graphand/core').ModelInstance<typeof Account> | undefined>;
//     register<P extends AuthProviders = AuthProviders.LOCAL, M extends AuthMethods = AuthMethods.WINDOW>(providerOrData: RegisterData<P, M> | P, methodOrData?: Omit<RegisterData<P, M>, "provider"> | M, _data?: Omit<RegisterData<P, M>, "provider" | "method">, query?: NonNullable<InferControllerInput<typeof controllerRegister>>["query"]): Promise<import('@graphand/core').ModelInstance<typeof Account> | undefined>;
//     refreshToken(): Promise<any>;
//     handleAuthResult<M extends AuthMethods>(result: AuthResult, method: M, options?: AuthMethodOptions<M>): Promise<import('@graphand/core').ModelInstance<typeof Account> | undefined>;
//     handleRedirectUrl(url: string | URL): Promise<URL>;
//     handleCode(code: string): Promise<import('@graphand/core').ModelInstance<typeof Account> | undefined>;
//     logout(): Promise<void>;
// }
// export default ModuleAuth;

// Server-side cached instance per request
export const getServerGraphandClient = cache(async () => {
  const headersList = await import("next/headers").then(mod => mod.headers());
  const project = headersList.get("x-project-subdomain") || null;
  const environment = headersList.get("x-environment") || "master";

  return new Client([[ModuleAuth, {}]], {
    project,
    environment,
    endpoint: process.env.GRAPHAND_CLIENT_ENDPOINT,
    ssl: Boolean(process.env.GRAPHAND_CLIENT_SSL === "true"),
  });
});

// Client-side instance getter
export function getClientGraphandClient(projectSubdomain: string, environment: string) {
  if (typeof window === "undefined") {
    throw new Error("getClientGraphandClient should only be called on client side");
  }

  clientInstance ||= new Client([[ModuleAuth, {}]], {
    project: projectSubdomain,
    environment,
    endpoint: process.env.GRAPHAND_CLIENT_ENDPOINT,
    ssl: Boolean(process.env.GRAPHAND_CLIENT_SSL === "true"),
  });

  return clientInstance;
}
