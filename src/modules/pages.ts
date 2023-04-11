import { Model, DataModel } from "@graphand/core";
import ClientAdapter from "../lib/ClientAdapter";
import { getClientFromModel } from "../lib/utils";

async function loadDatamodelPage(datamodel: DataModel) {
  if (!datamodel) {
    return;
  }

  if (datamodel.isPage && datamodel.__doc._page) {
    const client = getClientFromModel(datamodel.model);
    const PageModel: typeof Model = client.getModel(datamodel.slug);

    const adapter = PageModel.__adapter as ClientAdapter;

    adapter.mapOrNew(datamodel.__doc._page);
  }
}

DataModel.hook("after", "get", async function (data) {
  const datamodel = await data.res;
  await loadDatamodelPage(datamodel);
});

DataModel.hook("after", "getList", async function (data) {
  const list = await data.res;
  await Promise.all(list.map(loadDatamodelPage));
});
