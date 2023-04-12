import {
  ModelEnvScopes,
  FieldTypes,
  ValidatorsDefinition,
  Data,
  DataModel,
  FieldsDefinition,
  Model,
  models,
  ModelUpdateEvent,
  ModelCrudEvent,
  Rule,
  FieldsRestriction,
  defineFieldsProperties,
} from "@graphand/core";
import { ClientOptions } from "../types";
import Client from "./Client";
import ClientAdapter from "./ClientAdapter";

export const generateRandomString = () => {
  return "a" + Math.random().toString(36).substring(7);
};

export const fetchWatcher = async (
  model: typeof Model,
  opts: {
    _id?: string;
    fn?: (e: ModelUpdateEvent | ModelCrudEvent | any) => boolean;
    operation?: "fetch" | "create" | "update" | "delete" | "localUpdate";
    timeout?: number;
    subject?: "updater" | "event";
  }
) => {
  const adapter = model.getAdapter() as ClientAdapter;
  let unsub;
  let _timeout;

  let subject: any = adapter.updaterSubject;
  const operation = opts.operation ?? "fetch";

  if (opts.subject === "event") {
    subject = adapter.__eventSubject;
  }

  const fn =
    opts.fn ??
    ((e) => {
      return e.operation === operation && e.ids.includes(String(opts._id));
    });

  const timeout = opts.timeout ?? 600;

  return new Promise((resolve) => {
    unsub = subject.subscribe((e) => {
      if (fn(e)) resolve(true);
    });

    _timeout = setTimeout(() => {
      resolve(false);
    }, timeout);
  }).then((result) => {
    clearTimeout(_timeout);
    unsub();
    return result;
  });
};

export const generateModel = async (
  modelOrSlug?:
    | string
    | {
        slug?: string;
        fields?: FieldsDefinition;
        validators?: ValidatorsDefinition;
        configKey?: string;
        isPage?: boolean;
      },
  _fields: FieldsDefinition = {
    title: {
      type: FieldTypes.TEXT,
    },
  },
  client?: Client
): Promise<any> => {
  let slug;
  let fields;
  let validators;
  let configKey;
  let isPage;

  if (typeof modelOrSlug === "string") {
    slug = modelOrSlug;
  } else if (modelOrSlug) {
    slug = modelOrSlug.slug;
    fields = modelOrSlug.fields;
    validators = modelOrSlug.validators;
    configKey = modelOrSlug.configKey;
    isPage = modelOrSlug.isPage;
  }

  slug ??= generateRandomString();
  client ??= globalThis.client;
  fields ??= _fields;
  configKey ??= Object.keys(fields)[0];

  const datamodel = await client.getModel(models.DataModel).create({
    name: slug,
    slug,
    fields,
    validators,
    isPage,
    configKey,
  });

  return Model.getFromSlug(datamodel.slug);
};

export const mockAccountWithRole = async ({
  rules,
  fieldsRestrictions,
  client,
}: {
  rules?: Array<Rule>;
  fieldsRestrictions?: Array<FieldsRestriction>;
  client?: Client;
}) => {
  client ??= globalThis.client;

  const role = await client.getModel(models.Role).create({
    slug: generateRandomString(),
    rules,
    fieldsRestrictions,
  });

  const account = await client.getModel(models.Account).create({
    email: generateRandomString() + "@test.com",
    password: "test",
    role: role._id,
  });

  return account;
};

export const mockModel = ({
  scope = ModelEnvScopes.ENV,
  fields = {
    title: {
      type: FieldTypes.TEXT,
      options: {},
    },
  },
  validators = [],
}: {
  scope?: ModelEnvScopes;
  fields?: FieldsDefinition;
  validators?: ValidatorsDefinition;
} = {}) => {
  const uidSlug = generateRandomString();

  class Test extends Data {
    static slug = uidSlug;
    static scope = scope;
    static fields = fields;
    static validators = validators;

    constructor(doc) {
      super(doc);

      defineFieldsProperties(this);
    }

    title;
  }

  // Test.__datamodel = new DataModel({
  //   slug: uidSlug,
  //   fields,
  //   validators,
  // });

  return Test;
};

export const getClient = (assignOpts: Partial<ClientOptions> = {}) => {
  const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);
  return new Client({
    ...clientOptions,
    ...assignOpts,
  });
};

export const getClientWithSocket = () => {
  return getClient({
    sockets: ["project"],
  });
};
