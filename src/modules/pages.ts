import { Model, DataModel } from "@graphand/core";
import ClientAdapter from "../lib/ClientAdapter";
import { getClientFromModel } from "../lib/utils";

async function loadDatamodelPage(datamodel: DataModel) {
  if (!datamodel) {
    return;
  }

  if (datamodel.single && datamodel.__doc._doc) {
    const client = getClientFromModel(datamodel.model);
    const DocModel: typeof Model = client.getModel(datamodel.slug);

    const adapter = DocModel.getAdapter() as ClientAdapter;

    adapter.mapOrNew(datamodel.__doc._doc);
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
