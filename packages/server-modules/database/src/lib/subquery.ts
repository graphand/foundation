import { getPropertiesPathsFromPath, JSONObject, Model, Property, PropertyTypes } from "@graphand/core";
import { parseQuery } from "./utils.js";
import { getRequestHelper } from "@graphand/server";
import { ModuleDatabase } from "@/module.js";

export const decodeSubquery = async <T extends typeof Model>(model: T, object: JSONObject): Promise<void> => {
  const transform = async (input: any, path: Array<string> = []) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        input[i] = await transform(input[i], path);
      }
    } else {
      for (const key in input) {
        if (key.startsWith("$")) {
          await transform(input[key], path);
          continue;
        }

        const property = getPropertiesPathsFromPath(model, path.concat(key.split(".")))?.pop()?.property;

        if (!property || !input[key]?.$subquery) {
          continue;
        }

        if (property.type === PropertyTypes.RELATION) {
          const _property = property as Property<PropertyTypes.RELATION>;

          const ref = _property.definition.ref;

          if (!ref) {
            throw new Error(`Property "${path.concat(key.split("."))}" is not a relation`);
          }

          const targetModel = model.getClass(ref);

          await targetModel.initialize();

          const parsedQuery = await parseQuery(targetModel, {
            filter: input[key].$subquery,
            limit: input[key].$subqueryLimit || 1000,
          });

          const request = getRequestHelper(model);
          const subqueryResults = await request.server
            .get(ModuleDatabase)
            .service.findMany({ model: targetModel, parsedQuery });
          const ids = subqueryResults.map(r => r._id);

          input[key] = { $in: ids };
        } else if (property.type === PropertyTypes.OBJECT) {
          await transform(input[key], path.concat(key.split(".")));
        }
      }
    }

    return input;
  };

  return await transform(object);
};
