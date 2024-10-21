import { EventSubscription } from "@/models/EventSubscription.js";
import { generateRandomString, mockAdapter } from "@/lib/test-utils.dev.js";
import { ValidationError } from "../lib/ValidationError.js";
import { SubscriptionChannels } from "../enums/subscription-channels.js";
import { faker } from "@faker-js/faker";
import { ObjectId } from "bson";

describe("EventSubscription Model", () => {
  const adapter = mockAdapter();
  const EventSubscriptionModel = EventSubscription.extend({ adapterClass: adapter });

  it("should be able to create a simple event subscription", async () => {
    await expect(
      EventSubscriptionModel.create({
        slug: generateRandomString(),
        filter: { _id: { $exists: true } },
        channels: [
          {
            channel: SubscriptionChannels.EMAIL,
            options: { email: "test@test.com" },
          },
        ],
      }),
    ).resolves.toBeInstanceOf(EventSubscription);
  });

  it("should validate the event subscription filter", async () => {
    await expect(
      EventSubscriptionModel.create({
        slug: generateRandomString(),
        // @ts-ignore
        filter: "foo",
      }),
    ).rejects.toThrow(ValidationError);
  });

  describe("options.channels", () => {
    it("should reject when channels array is empty", async () => {
      await expect(
        EventSubscriptionModel.create({
          slug: generateRandomString(),
          channels: [],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("should reject when channel is invalid", async () => {
      await expect(
        EventSubscriptionModel.create({
          slug: generateRandomString(),
          channels: [
            {
              channel: "invalid" as SubscriptionChannels,
            },
          ],
        }),
      ).rejects.toThrow(ValidationError);
    });

    describe("channel email", () => {
      it("should reject when email channel is provided without options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.EMAIL,
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when email channel is provided with empty options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.EMAIL,
                options: {},
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when email value is not a valid email", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.EMAIL,
                options: {
                  email: "test",
                },
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should resolve when email channel is provided with a valid email", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.EMAIL,
                options: {
                  email: faker.internet.email(),
                },
              },
            ],
          }),
        ).resolves.toBeInstanceOf(EventSubscription);
      });
    });

    describe("channel account", () => {
      it("should reject when account channel is provided without options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ACCOUNT,
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when account ID is invalid", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ACCOUNT,
                options: {
                  account: "invalid-id",
                },
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should resolve when account channel is provided with a valid account ID", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ACCOUNT,
                options: {
                  account: new ObjectId().toString(),
                },
              },
            ],
          }),
        ).resolves.toBeInstanceOf(EventSubscription);
      });

      it("should resolve when account channel is provided with an account field", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ACCOUNT,
                options: {
                  accountField: "account",
                },
              },
            ],
          }),
        ).resolves.toBeInstanceOf(EventSubscription);
      });
    });

    describe("channel role", () => {
      it("should reject when role channel is provided without options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ROLE,
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when role channel is provided with empty options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ROLE,
                options: {},
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when role ID is invalid", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ROLE,
                options: {
                  role: "invalid-id",
                },
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should resolve when role channel is provided with a valid role ID", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.ROLE,
                options: {
                  role: new ObjectId().toString(),
                },
              },
            ],
          }),
        ).resolves.toBeInstanceOf(EventSubscription);
      });
    });

    describe("channel slack", () => {
      it("should reject when slack channel is provided without options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.SLACK,
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when slack channel is provided with empty options", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.SLACK,
                options: {},
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should reject when webhook URL for slack is invalid", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.SLACK,
                options: {
                  slackWebhookUrl: "invalid-url",
                },
              },
            ],
          }),
        ).rejects.toThrow(ValidationError);
      });

      it("should resolve when slack channel is provided with a valid webhook URL", async () => {
        await expect(
          EventSubscriptionModel.create({
            slug: generateRandomString(),
            channels: [
              {
                channel: SubscriptionChannels.SLACK,
                options: {
                  slackWebhookUrl: faker.internet.url(),
                },
              },
            ],
          }),
        ).resolves.toBeInstanceOf(EventSubscription);
      });
    });
  });
});
