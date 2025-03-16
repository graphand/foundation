import { Role } from "@/models/role.js";
import { RuleActions } from "@/enums/rule-actions.js";
import { mockAdapter } from "@/lib/test-utils.dev.js";
import { faker } from "@faker-js/faker";

describe("Role Model", () => {
  const adapter = mockAdapter();
  const RoleModel = Role.extend({ adapterClass: adapter });

  it("should be able to create a simple role", async () => {
    await expect(
      RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "test", actions: [RuleActions.CREATE] }],
      }),
    ).resolves.toBeInstanceOf(RoleModel);
  });

  describe("getRulesInherited", () => {
    it("should return own rules if no inherited roles", async () => {
      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "test", actions: [RuleActions.CREATE] }],
      });

      const rules = await instance.getRulesInherited();
      expect(rules).toEqual([{ ref: "test", actions: [RuleActions.CREATE] }]);
    });

    it("should return combined rules from inherited roles", async () => {
      const inheritedRole1 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "inherited1", actions: [RuleActions.CREATE] }],
      });

      const inheritedRole2 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "inherited2", actions: [RuleActions.UPDATE] }],
      });

      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "test", actions: [RuleActions.DELETE] }],
        inherits: [inheritedRole1._id as string, inheritedRole2._id as string],
      });

      const rules = await instance.getRulesInherited();
      expect(rules).toEqual([
        { ref: "test", actions: [RuleActions.DELETE] },
        { ref: "inherited1", actions: [RuleActions.CREATE] },
        { ref: "inherited2", actions: [RuleActions.UPDATE] },
      ]);
    });

    it("should return combined rules from inherited roles recursively", async () => {
      const inheritedRole1 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "inherited1", actions: [RuleActions.CREATE] }],
      });

      const inheritedRole2 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "inherited2", actions: [RuleActions.UPDATE] }],
        inherits: [inheritedRole1._id as string],
      });

      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        rules: [{ ref: "test", actions: [RuleActions.DELETE] }],
        inherits: [inheritedRole2._id as string],
      });

      const rules = await instance.getRulesInherited();
      expect(rules).toEqual([
        { ref: "test", actions: [RuleActions.DELETE] },
        { ref: "inherited2", actions: [RuleActions.UPDATE] },
        { ref: "inherited1", actions: [RuleActions.CREATE] },
      ]);
    });
  });

  describe("getPropertiesRestrictionsInherited", () => {
    it("should return own propertiesRestrictions if no inherited roles", async () => {
      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "test", actions: [RuleActions.CREATE] }],
      });

      const propertiesRestrictions = await instance.getPropertiesRestrictionsInherited();
      expect(propertiesRestrictions).toEqual([{ ref: "test", actions: [RuleActions.CREATE] }]);
    });

    it("should return combined propertiesRestrictions from inherited roles", async () => {
      const inheritedRole1 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "inherited1", actions: [RuleActions.CREATE] }],
      });

      const inheritedRole2 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "inherited2", actions: [RuleActions.UPDATE] }],
      });

      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "test", actions: [RuleActions.DELETE] }],
        inherits: [inheritedRole1._id as string, inheritedRole2._id as string],
      });

      const propertiesRestrictions = await instance.getPropertiesRestrictionsInherited();
      expect(propertiesRestrictions).toEqual([
        { ref: "test", actions: [RuleActions.DELETE] },
        { ref: "inherited1", actions: [RuleActions.CREATE] },
        { ref: "inherited2", actions: [RuleActions.UPDATE] },
      ]);
    });

    it("should return combined propertiesRestrictions from inherited roles recursively", async () => {
      const inheritedRole1 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "inherited1", actions: [RuleActions.CREATE] }],
      });

      const inheritedRole2 = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "inherited2", actions: [RuleActions.UPDATE] }],
        inherits: [inheritedRole1._id as string],
      });

      const instance = await RoleModel.create({
        slug: faker.random.alphaNumeric(10),
        propertiesRestrictions: [{ ref: "test", actions: [RuleActions.DELETE] }],
        inherits: [inheritedRole2._id as string],
      });

      const propertiesRestrictions = await instance.getPropertiesRestrictionsInherited();
      expect(propertiesRestrictions).toEqual([
        { ref: "test", actions: [RuleActions.DELETE] },
        { ref: "inherited2", actions: [RuleActions.UPDATE] },
        { ref: "inherited1", actions: [RuleActions.CREATE] },
      ]);
    });
  });
});
