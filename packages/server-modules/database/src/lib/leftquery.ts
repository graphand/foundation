import { getPropertiesPathsFromPath, JSONObject, Model, Property, PropertyTypes } from "@graphand/core";
import { isObjectId, parseQuery, toId } from "./utils.js";
import { getRequestHelper } from "@graphand/server";
import { ModuleDatabase } from "@/module.js";
import { ObjectId } from "mongodb";

export const decodeLeftquery = async <T extends typeof Model>(model: T, object: JSONObject): Promise<void> => {
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

        if (!input[key] || typeof input[key] !== "object" || !input[key].$leftquery) {
          await transform(input[key], path.concat(key.split(".")));
          continue;
        }

        const leftquery = input[key].$leftquery;
        if (!leftquery.from || !leftquery.filter || !leftquery.property) {
          continue;
        }

        const request = getRequestHelper(model);

        // Get the target model by slug
        const targetModel: typeof Model = request.model(leftquery.from);
        if (!targetModel) {
          throw new Error(`Model with slug "${leftquery.from}" not found`);
        }

        await targetModel.initialize();

        const property = getPropertiesPathsFromPath(targetModel, leftquery.property)?.pop()?.property;

        if (!property) {
          throw new Error(`Property "${leftquery.property}" not found on model "${targetModel.configuration.slug}"`);
        }

        if (property.type === PropertyTypes.RELATION) {
          const _relProperty = property as Property<PropertyTypes.RELATION>;
          const ref = _relProperty.definition.ref;
          if (ref !== model.configuration.slug) {
            throw new Error(
              `Relation property "${leftquery.property}" is not a relation to "${model.configuration.slug}"`,
            );
          }
        } else if (property.type === PropertyTypes.ARRAY) {
          const _arrProperty = property as Property<PropertyTypes.ARRAY>;
          if (_arrProperty.definition.items.type !== PropertyTypes.RELATION) {
            throw new Error(`Array property "${leftquery.property}" is not an array of relations`);
          }

          const ref = _arrProperty.definition.items.ref;
          if (ref !== model.configuration.slug) {
            throw new Error(
              `Array property "${leftquery.property}" is not an array of relations to "${model.configuration.slug}"`,
            );
          }
        } else {
          throw new Error(`Property "${leftquery.property}" is not a relation or an array of relations`);
        }

        const { filter, options } = await parseQuery(targetModel, {
          filter: leftquery.filter,
          limit: leftquery.$leftqueryLimit || 1000,
        });

        const results = await request.server
          .get(ModuleDatabase)
          .service.findMany({ model: targetModel, filter, options });

        // Extract the property values from the results
        const propertyValues: Array<ObjectId> = [];

        for (const result of results) {
          const propertyValue = targetModel.hydrate(result).get(leftquery.property, "json");
          if (Array.isArray(propertyValue)) {
            propertyValues.push(...propertyValue.filter(isObjectId).map(toId));
          } else if (isObjectId(propertyValue)) {
            propertyValues.push(toId(propertyValue));
          }
        }

        // Replace the $leftquery with an $in query
        const ids = propertyValues.filter(isObjectId);
        input[key] = { $in: Array.from(new Set(ids)) };
      }
    }

    return input;
  };

  return await transform(object);
};
