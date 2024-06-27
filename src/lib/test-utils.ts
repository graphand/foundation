import {
  FieldTypes,
  ValidatorsDefinition,
  FieldsDefinition,
  Model,
  ModelCrudEvent,
  Rule,
  FieldsRestriction,
  defineFieldsProperties,
  DataModel,
  Role,
  Account,
  ModelDefinition,
  ModelJSON,
  ModelInstance,
} from "@graphand/core";
import { ClientOptions, ModelUpdaterEvent } from "../types";
import Client from "./Client";
import ClientAdapter from "./ClientAdapter";
import fs from "fs";
import path from "path";
import mime from "mime";

export const generateRandomString = () => {
  return "a" + Math.random().toString(36).substring(7);
};

export const getFile = async (fileName = "sample.png") => {
  const filePath = path.resolve(__dirname, `../__tests__/assets/${fileName}`);
  const buffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const type = mime.getType(filePath);
  return new File([new Blob([buffer], { type })], name, { type });
};

export const fetchWatcher = async (
  model: typeof Model,
  opts: {
    _id?: string;
    fn?: (e: ModelUpdaterEvent) => boolean;
    operation?: "fetch" | "create" | "update" | "delete";
    timeout?: number;
    subject?: "updater" | "event";
  }
) => {
  const adapter = model.getAdapter() as ClientAdapter;
  let unsub;
  let _timeout;

  let subject = adapter.updaterSubject;
  const operation = opts.operation ?? "fetch";

  if (opts.subject === "event") {
    subject = adapter.__eventSubject;
  }

  let fn = opts.fn;
  if (!fn) {
    fn = (e) => e.operation === operation && e.ids.includes(String(opts._id));
  }

  const timeout = opts.timeout ?? 2000;

  return new Promise<ModelUpdaterEvent | false>((resolve) => {
    unsub = subject.subscribe((e) => {
      if (fn(e)) resolve(e);
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

export const generateModel = async <
  T extends typeof Model = typeof Model & {
    definition: {
      fields: {
        title: {
          type: FieldTypes.TEXT;
        };
      };
    };
  }
>(opts: {
  slug?: string;
  definition?: T["definition"];
  client?: Client;
}): Promise<T> => {
  const slug = opts.slug ?? generateRandomString();
  const client = opts.client ?? globalThis.clientProject;
  const definition = opts.definition ?? {
    fields: {
      title: {
        type: FieldTypes.TEXT,
      },
    },
    validators: [],
  };

  const datamodel = await client.getModel(DataModel).create({
    name: `Model ${slug}`,
    slug,
    definition,
  });

  const model = client.getModel(datamodel) as T;
  await model.initialize();
  return model;
};

export const getClientProject = (assignOpts: Partial<ClientOptions> = {}) => {
  const clientOptions = JSON.parse(process.env.CLIENT_PROJECT_OPTIONS);
  const client = new Client({
    ...clientOptions,
    ...assignOpts,
  });

  globalThis.clients ??= [];
  globalThis.clients.push(client);

  return client;
};

export const generateAccountWithRole = async (
  payload: ModelJSON<typeof Role>,
  opts: {
    client?: Client;
  } = {}
): Promise<ModelInstance<typeof Account>> => {
  const client = opts.client ?? globalThis.clientProject;

  payload.slug ??= generateRandomString();
  const role = await client.getModel(Role).create(payload);
  const account = await client.getModel(Account).create({
    role: role._id,
  });

  return account;
};
