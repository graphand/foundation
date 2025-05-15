import { parseQuery } from "@/lib/utils.js";
import { Model } from "@graphand/core";

export const init = () => {
  Model.hook(
    "before",
    "count",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "get",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "getList",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "updateOne",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "updateMultiple",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "deleteOne",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );

  Model.hook(
    "before",
    "deleteMultiple",
    async function (data) {
      data.ctx.parsedQuery = await parseQuery(this, data.args[0]);
    },
    { order: -2 },
  );
};
