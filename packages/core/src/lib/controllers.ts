import {
  ConfigureData,
  Controller,
  JSONQuery,
  JSONObject,
  LoginData,
  MediaTransformOptions,
  ModelJSON,
  RegisterData,
} from "@/types/index.js";

export const controllerModelCount: Controller<{ params: { model: string }; query?: JSONQuery; data?: JSONQuery }> = {
  path: "/:model/count",
  methods: ["get", "post"],
  secured: true,
};

export const controllerModelCreate: Controller<{ params: { model: string }; data: ModelJSON | ModelJSON[] }> = {
  path: "/:model",
  methods: ["post"],
  secured: true,
};

export const controllerModelDelete: Controller<{ params: { model: string; id?: string }; query?: JSONQuery }> = {
  path: "/:model/:id?",
  methods: ["delete"],
  secured: true,
};

export const controllerModelQuery: Controller<{ params: { model: string }; query?: JSONQuery; data?: JSONQuery }> = {
  path: "/:model/query",
  methods: ["get", "post"],
  secured: true,
};

export const controllerModelRead: Controller<{ params: { model: string; id?: string }; query?: JSONQuery }> = {
  path: "/:model/:id?",
  methods: ["get"],
  secured: true,
};

export const controllerModelUpdate: Controller<{
  params: { model: string; id?: string };
  query?: JSONQuery;
  data: { update: JSONObject } & JSONQuery;
}> = {
  path: "/:model/:id?",
  methods: ["patch"],
  secured: true,
};

export const controllerCurrentAccount: Controller = {
  path: "/accounts/current",
  methods: ["get"],
  secured: true,
};

export const controllerEntry: Controller = {
  path: "/",
  methods: ["get"],
  secured: false,
};

export const controllerLogin: Controller<{ data: LoginData }> = {
  path: "/auth/login",
  methods: ["post"],
  secured: false,
};

export const controllerGenAccountToken: Controller<{ params: { id: string } }> = {
  path: "/accounts/:id/gen-token",
  methods: ["post"],
  secured: true,
};

export const controllerAccountPendingEmail: Controller<{ params: { id: string } }> = {
  path: "/accounts/:id/pending-email",
  methods: ["get"],
  secured: true,
};

export const controllerGdxPull: Controller<{
  query?: {
    includeSystemProperties?: boolean;
    omitMeta?: boolean;
  };
  data?: Record<string, JSONQuery | true>;
}> = {
  path: "/gdx/pull",
  methods: ["post"],
  secured: true,
};

export const controllerGdxPush: Controller<{
  query?: {
    clean?: boolean;
    force?: boolean;
    ignoreHooks?: boolean;
    confirmChecksum?: string;
  };
  data: JSONObject;
}> = {
  path: "/gdx/push",
  methods: ["post"],
  secured: true,
};

export const controllerOpenapi: Controller = {
  path: "/oas",
  methods: ["get"],
  secured: false,
};

export const controllerGenTokenIssuerToken: Controller<{ params: { id: string } }> = {
  path: "/tokenIssuers/:id/gen",
  methods: ["post"],
  secured: true,
};

export const controllerGenSecretToken: Controller<{
  params: { id: string };
  data: {
    claimToken: string; // The identity self-signed token that is supposed to be encoded with the secret value as the private key
  };
}> = {
  path: "/secrets/:id/gen",
  methods: ["post"],
  secured: false,
};

export const controllerGenSecretKeyPair: Controller<{ data: { name: string } }> = {
  path: "/secrets/gen-key-pair",
  methods: ["post"],
  secured: true,
};

export const controllerRefreshToken: Controller<{ data: { accessToken: string; refreshToken: string } }> = {
  path: "/auth/refresh",
  methods: ["post"],
  secured: false,
};

export const controllerRegister: Controller<{ query?: { invitationToken?: string }; data: RegisterData }> = {
  path: "/auth/register",
  methods: ["post"],
  secured: false,
};

export const controllerCallbackAuth: Controller<{ query: { error?: string; state: string } }> = {
  path: "/auth/callback",
  methods: ["get"],
  secured: false,
};

export const controllerCodeAuth: Controller<{ query: { code: string } }> = {
  path: "/auth/code",
  methods: ["get"],
  secured: false,
};

export const controllerConfigureAuth: Controller<{ data: ConfigureData }> = {
  path: "/auth/configure",
  methods: ["post"],
  secured: false,
};

export const controllerMediaTus: Controller<{ params: { id?: string } }> = {
  path: "/medias/tus/:id?",
  methods: ["post", "patch", "delete"],
  secured: true,
};

export const controllerMediaPublic: Controller<{
  params: { id: string };
  query?: MediaTransformOptions & {
    download?: boolean;
  };
}> = {
  path: "/medias/public/:id",
  methods: ["get"],
  secured: false,
};

export const controllerMediaPrivate: Controller<{
  params: { id: string };
  query?: MediaTransformOptions & {
    download?: boolean;
  };
}> = {
  path: "/medias/private/:id",
  methods: ["get"],
  secured: true,
};

export const controllerSubscriptionsUpgrade: Controller<{
  data: {
    plan?: string;
    priceId?: string;
  };
}> = {
  path: "/subscriptions/upgrade",
  methods: ["post"],
  secured: true,
};

export const controllerSubscriptionsCurrent: Controller = {
  path: "/subscriptions/current",
  methods: ["get"],
  secured: true,
};

export const controllerSubscriptionsPortal: Controller = {
  path: "/subscriptions/portal",
  methods: ["get"],
  secured: true,
};

export const controllerConnectorReset: Controller<{ params: { id: string } }> = {
  path: "/connectors/:id/reset",
  methods: ["post"],
  secured: true,
};

export const controllerConnectorSync: Controller<{ params: { id: string } }> = {
  path: "/connectors/:id/sync",
  methods: ["post"],
  secured: true,
};

export const controllerConnectorQuery: Controller<{ params: { id: string } }> = {
  path: "/connectors/:id/query",
  methods: ["post"],
  secured: true,
};

export const controllerConnectorLogs: Controller<{
  params: { id: string };
  query?: {
    stream?: string;
    since?: number;
    limit?: number;
  };
}> = {
  path: "/connectors/:id/logs",
  methods: ["get"],
  secured: true,
};

export const controllerMrGDX: Controller<{ params: { id: string } }> = {
  path: "/merge-requests/:id/gdx",
  methods: ["get"],
  secured: true,
};

export const controllerSnapshotsRestore: Controller<{ params: { id: string } }> = {
  path: "/snapshots/:id/restore",
  methods: ["post"],
  secured: true,
};

export const controllerFunctionLogs: Controller<{
  params: { id: string };
  query?: {
    stream?: string;
    since?: number;
    limit?: number;
  };
}> = {
  path: "/functions/:id/logs",
  methods: ["get"],
  secured: true,
};

export const controllerFunctionBindTunnel: Controller<{
  data: {
    tunnelUrl: string;
    mapping: Record<string, string>;
  };
}> = {
  path: "/functions/bind-tunnel",
  methods: ["post"],
  secured: true,
};

export const controllerFunctionUnbindTunnel: Controller<{
  data: {
    tunnelUrl: string;
    mapping: Record<string, string>;
  };
}> = {
  path: "/functions/unbind-tunnel",
  methods: ["post"],
  secured: true,
};

export const controllerJobLogs: Controller<{
  params: { id: string };
  query?: {
    stream?: string;
    since?: number;
    limit?: number;
  };
}> = {
  path: "/jobs/:id/logs",
  methods: ["get"],
  secured: true,
};

export const controllerFunctionRun: Controller<{
  params: { id: string; path?: string };
  query?: { runInJob?: boolean };
}> = {
  path: "/functions/:id/run/:*path?",
  methods: ["get", "post", "put", "delete", "patch", "options"],
  secured: true,
};

export const controllerAggregationRun: Controller<{
  params: { id: string };
  data?: { let: JSONObject };
}> = {
  path: "/aggregations/:id/run",
  methods: ["post"],
  secured: true,
};

export const controllerEventSubscriptionsTest: Controller<{
  params: { id: string };
}> = {
  path: "/eventSubscriptions/:id/test",
  methods: ["post"],
  secured: true,
};
