import Client from "./index";
import Account from "./models/Account";
import "cross-fetch/polyfill";
import { Project } from "@graphand/core";

async function main() {
  // const res = await Account.getList({});
  // console.log(res);

  const client = new Client({
    project: "6394890ab7916114d4232b93",
  });

  await client.login("john.doe@gmail.com", "test123");

  // const ProjectModel = client.getModel(Project);
  // const projects = await ProjectModel.getList();
  // projects[0].test();
  // @ts-ignore
  // console.log(, projects[0]?.get("name"));

  const a = await client
    .getModel(Account)
    .create({ firstname: "toto", lastname: "toto" });
  console.log(a.toJSON());

  await client.getModel(Account).delete({ filter: { firstname: "toto" } });

  // await a.update({ $set: { firstname: "totox" } });
  //
  const res = await client.getModel(Account).getList({});

  console.log(res.count);

  // console.log(a.toJSON(), a.createdBy);

  // const randomStr = Math.random().toString(10);
  //
  // await a.update({ $set: { firstname: randomStr } });
  // console.log(a.toJSON());
  //
  // const a2 = await client
  //   .getModel(Account)
  //   .get({ filter: { firstname: randomStr } });
  //
  // console.log(a2.toJSON(), a.__uid, a2.__uid);

  // await client
  //   .getModel(Account)
  //   .create({ firstname: "toto", lastname: "toto" });
  //
  // const list = await client.getModel(Account).getList();
  // console.log(list.count);

  // const role = a.role;
  // console.log(a.toJSON(), role);

  // const count = await client
  //   .getModel(Account)
  //   .count({ filter: { firstname: { $regex: "P" } } });
  // console.log(count);

  // const list = await client
  //   .getModel(Account)
  //   .getList({ filter: { firstname: { $regex: "P" } }, pageSize: 150 });
  //
  // console.log(list.length, list.count);
}

main();
