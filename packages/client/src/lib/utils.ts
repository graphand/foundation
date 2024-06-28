import { JSONQuery } from "@graphand/core";

export const canUseIds = (query: JSONQuery): boolean => {
  if (
    !query.ids ||
    !Array.isArray(query.ids) ||
    !query.ids?.length ||
    query.filter ||
    query.pageSize ||
    query.limit ||
    query.skip ||
    query.sort ||
    query.populate
  ) {
    return false;
  }

  return true;
};
