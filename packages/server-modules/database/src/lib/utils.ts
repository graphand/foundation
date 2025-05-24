import {
  ErrorCodes,
  getPropertiesPathsFromPath,
  JSONObject,
  JSONQuery,
  Model,
  ModelInstance,
  ModelList,
  PropertyTypes,
} from "@graphand/core";
import { getRequestHelper, HTTPStatusCodes, ServerError } from "@graphand/server";
import { Filter, FindOptions, MongoError, ObjectId } from "mongodb";
import { decodeSubquery } from "./subquery.js";
import { decodeLeftquery } from "./leftquery.js";
import { Redis, RedisOptions, Cluster, ClusterOptions } from "ioredis";

export const isRetryableMongoError = (e: Error) => {
  if (!(e instanceof MongoError)) {
    return false;
  }

  if (e.message.includes("retry")) {
    return true;
  }

  if ("codeName" in e && ["WriteConflict", "SnapshotUnavailable", "NoSuchTransaction"].includes(e.codeName as string)) {
    return true;
  }

  return false;
};

export const isObjectId = (input: unknown) => {
  if (!input) {
    return false;
  }

  if (Array.isArray(input)) {
    return false;
  }

  return input instanceof ObjectId || /^[a-f\d]{24}$/i.test(String(input));
};

export const isSpecialObject = (obj: unknown): boolean => {
  return obj instanceof Model || obj instanceof ModelList || obj instanceof Date || obj instanceof ObjectId;
};

export const toId = (input: unknown): ObjectId => {
  if (!input) {
    throw new Error("Input is invalid");
  }

  if (Array.isArray(input)) {
    throw new Error("Input is invalid");
  }

  if (input instanceof ObjectId) {
    return input;
  }

  if (!input || typeof input !== "string" || !isObjectId(input)) {
    throw new Error("Input is invalid");
  }

  if (typeof input === "object" && (input as object) instanceof ObjectId) {
    return input;
  }

  return new ObjectId(input);
};

export const getVars = async <T extends typeof Model>(model: T, strFilter: string): Promise<Record<string, string>> => {
  console.log(model, strFilter);
  // TODO: Implement
  return {};
};

export const parseQuery = async <T extends typeof Model>(
  model: T,
  query: JSONQuery | string,
): Promise<{ filter: Filter<T>; options: Record<string, any> }> => {
  if (!query) {
    throw new Error("Query is invalid");
  }

  await model.initialize();

  const _isPotentialKey = (v: any) => typeof v === "string" || v instanceof ObjectId;

  const foundKey = _isPotentialKey(query)
    ? query
    : query && typeof query === "object" && _isPotentialKey(query.filter)
      ? query.filter
      : null;

  if (foundKey) {
    const foundObjectId = isObjectId(foundKey);
    const keyProperty = foundObjectId ? "_id" : model.getKeyProperty();
    const value = foundObjectId ? toId(foundKey) : foundKey;

    if (keyProperty === "_id" && !foundObjectId) {
      throw new ServerError({
        code: ErrorCodes.INVALID_PARAMS,
        message: `Unable to parse query string "${foundKey}" on model ${model.name} with _id as keyProperty`,
        httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
      });
    }

    return {
      filter: { [keyProperty]: value } as Filter<T>,
      options: { limit: 1 },
    };
  }

  if (typeof query === "string") {
    throw new ServerError({
      code: ErrorCodes.INVALID_PARAMS,
      message: `Query string "${query}" is invalid`,
      httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
    });
  }

  let filter = query.filter ? JSON.parse(JSON.stringify(query.filter)) : {};

  if (Array.isArray(query.ids)) {
    const _idIn = {
      $in: query.ids.map(toId),
    };

    if (filter?._id) {
      filter = { $and: [{ _id: _idIn }, filter] };
    } else {
      filter._id = _idIn;
    }
  }

  const options: {
    limit?: FindOptions["limit"];
    skip?: FindOptions["skip"];
    sort?: FindOptions["sort"];
    let?: Record<string, string>;
  } = {};

  const limit = Number(query.limit) || undefined;
  const pageSize = Number(query.pageSize) || undefined;
  const page = (Number(query.page) || 1) - 1;
  const skip = Number(query.skip) || undefined;

  if (limit && pageSize) {
    options.limit = Math.min(limit, pageSize);
  } else {
    options.limit = limit ?? pageSize;
  }

  if (page < 0 || Number(query.page) <= 0) {
    throw new ServerError({
      code: ErrorCodes.INVALID_PARAMS,
      message: "Page must be greater than 0",
      httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
    });
  }

  if ((options.limit && options.limit <= 0) || Number(query.pageSize) <= 0) {
    throw new ServerError({
      code: ErrorCodes.INVALID_PARAMS,
      message: "Page must be greater than 0",
      httpStatusCode: HTTPStatusCodes.BAD_REQUEST,
    });
  }

  if (skip || options.limit) {
    options.skip = skip ?? (pageSize ?? options.limit!) * page;
  }

  options.limit ??= query.ids?.length ?? 100;
  if (options.limit > 1000) {
    const request = getRequestHelper(model);
    if (request) {
      const exception = new ServerError({
        code: ErrorCodes.INVALID_PARAMS,
        message: `Limit of 1000 elements in query is exceeded (${options.limit})`,
        httpStatusCode: HTTPStatusCodes.PARTIAL_CONTENT,
      });

      request.addResponseException(exception);
    }

    options.limit = 1000;
  }

  if (filter && typeof filter === "object") {
    const filterStr = JSON.stringify(filter);
    let newFilter = filter;
    const vars = await getVars(model, filterStr);

    // Handle subqueries and leftqueries if they exist
    if (filterStr.includes("$subquery")) {
      newFilter = await decodeSubquery(model, JSON.parse(JSON.stringify(filter)));
    }

    if (filterStr.includes("$leftquery")) {
      newFilter = await decodeLeftquery(model, JSON.parse(JSON.stringify(filter)));
    }

    if (vars) {
      options.let = vars;
    }

    filter = newFilter;

    await parseModelObject(filter, model.hydrate({}));
  }

  if (query.sort) {
    if (typeof query.sort === "string") {
      options.sort = query.sort.split(",").reduce((acc, property) => {
        const order = property.startsWith("-") ? -1 : 1;
        const key = property.replace(/^-/, "");
        return { ...acc, [key]: order };
      }, {});
    } else {
      options.sort = {};

      Object.entries(query.sort).forEach(([key, value]) => {
        let _value = value as JSONQuery["sort"];

        if (typeof value === "string") {
          _value = value === "desc" ? -1 : 1;
        }

        const sort = options.sort as Record<string, number>;
        sort[key] = _value as number;
      });
    }
  }

  return {
    filter,
    options,
  };
};

export const parseModelObject = async (obj: JSONObject, from: ModelInstance, path: string[] = []) => {
  for await (const [key, value] of Object.entries(obj)) {
    const nextPath = [...path, ...key.split(".")];

    if (value === undefined) {
      delete obj[key];
      continue;
    }

    if (value && typeof value === "object" && !isSpecialObject(value)) {
      await parseModelObject(value as JSONObject, from, nextPath);
      continue;
    }

    if (isSpecialObject(value) || value === null || value === undefined) {
      continue;
    }

    for (let i = nextPath.length - 1; i >= 0; i--) {
      const propertyPath = nextPath.slice(0, i + 1);
      const cleanPath = propertyPath.filter((p, i) => {
        if (p.startsWith("$")) return false;
        if (i > 0 && propertyPath[i - 1]?.startsWith("$") && !Number.isNaN(Number(p))) return false;
        return true;
      });
      const property = getPropertiesPathsFromPath(from.model(), cleanPath)?.pop()?.property;
      if (property) {
        const decoded = await property.serialize({
          value,
          format: "data",
          from,
          ctx: {},
        });

        if (property.type === PropertyTypes.ARRAY) {
          obj[key] = (decoded as any[])[0];
        } else {
          obj[key] = decoded as any;
        }
        break;
      }
    }
  }
};

export function createRedisClient(options: { uri: string; password?: string; cluster?: boolean }): Redis | Cluster {
  const { uri, password, cluster } = options;

  if (cluster) {
    const clusterOptions: ClusterOptions = {
      enableAutoPipelining: true,
      lazyConnect: true,
    };

    if (password) {
      clusterOptions.redisOptions = { password };
    }

    return new Cluster([{ host: uri, port: 6379 }], clusterOptions);
  } else {
    const redisOptions: RedisOptions = {
      lazyConnect: true,
      enableAutoPipelining: true,
    };

    if (password) {
      redisOptions.password = password;
    }

    // Parse URI to get host and port
    let host = uri;
    let port = 6379;

    if (uri.includes(":")) {
      const [hostPart, portPart] = uri.split(":");
      if (hostPart) {
        host = hostPart;
      }
      if (portPart) {
        port = parseInt(portPart, 10) || 6379;
      }
    }

    redisOptions.host = host;
    redisOptions.port = port;

    return new Redis(redisOptions);
  }
}
