import { Account, Project, ModelList, Role } from "@graphand/core";
import { generateRandomString, getClient } from "../../lib/test-utils";
import { faker } from "@faker-js/faker";
import jwt from "jsonwebtoken";

describe("test utils", () => {
  describe("test executeController", () => {
    let project;
    let client;

    beforeAll(async () => {
      project = await Project.create({
        name: generateRandomString(),
        slug: generateRandomString(),
        organization: process.env.ORGANIZATION_ID,
        accessTokenLifetime: 1,
      });

      client = getClient({
        project: project._id,
      });
    });

    afterAll(async () => {
      await project.delete();

      await client.close();
    });

    it("should refresh token if expired", async () => {
      const role = await client.getModel(Role).create({
        slug: generateRandomString(),
      });
      const account = await client.getModel(Account).create({
        email: faker.internet.email(),
        role,
      });

      const _accessToken = await client.genAccountToken(account._id);

      const newClient = getClient({
        project: project._id,
        accessToken: _accessToken,
        refreshToken: undefined,
      });

      await newClient.configureAuth({
        configuration: {
          password: "test",
        },
      });
      await newClient.loginAccount({
        credentials: {
          email: account.email,
          password: "test",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { exp: expBefore } = jwt.decode(newClient.options.accessToken);

      // expect token to be expired
      expect(expBefore).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));

      await expect(
        newClient.getModel(Account).getList()
      ).resolves.toBeInstanceOf(ModelList);

      const { exp: expAfter } = jwt.decode(newClient.options.accessToken);

      // expect token to be refreshed
      expect(expAfter).toBeGreaterThan(expBefore);
    });

    it("parallels calls should refresh token once", async () => {
      const role = await client.getModel(Role).create({
        slug: generateRandomString(),
      });
      const account = await client.getModel(Account).create({
        email: faker.internet.email(),
        role,
      });

      const _accessToken = await client.genAccountToken(account._id);

      const newClient = getClient({
        project: project._id,
        accessToken: _accessToken,
        refreshToken: undefined,
      });

      await newClient.configureAuth({
        configuration: {
          password: "test",
        },
      });
      await newClient.loginAccount({
        credentials: {
          email: account.email,
          password: "test",
        },
      });

      const spy = jest.spyOn(newClient, "refreshToken");

      expect(spy).toHaveBeenCalledTimes(0);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await Promise.all([
        newClient.getModel(Account).getList(),
        newClient.getModel(Account).getList(),
        newClient.getModel(Account).getList(),
        newClient.getModel(Account).getList(),
        newClient.getModel(Account).getList(),
      ]);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
