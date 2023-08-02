import Client from "../../lib/Client";
import { Token, ErrorCodes } from "@graphand/core";
import { fetchWatcher, generateRandomString } from "../../lib/test-utils";
import { ObjectId } from "bson";
import FetchError from "../../lib/FetchError";

describe("controller genTokenToken", () => {
  const roleId = String(new ObjectId());
  const client = globalThis.client as Client;
  const clientOptions = JSON.parse(process.env.CLIENT_OPTIONS);
  const clientWithSocket = new Client({
    ...clientOptions,
    sockets: ["project"],
  });

  afterAll(() => {
    clientWithSocket.close();
  });

  it("should return a valid access token from valid token", async () => {
    const token = await Token.create({
      name: generateRandomString(),
      role: roleId,
    });

    const accessToken = await client.genTokenToken(token._id);
    expect(typeof accessToken).toBe("string");
  });

  it("should throw error if token is not valid", async () => {
    const promise = client.genTokenToken(String(new ObjectId()));

    await expect(promise).rejects.toThrow(FetchError);
    await expect(promise).rejects.toHaveProperty("code", ErrorCodes.NOT_FOUND);
  });

  it("should throw error if maxGen is reached", async () => {
    const token = await Token.create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 3,
    });

    await expect(client.genTokenToken(token._id)).resolves.toBeDefined();
    await expect(client.genTokenToken(token._id)).resolves.toBeDefined();
    await expect(client.genTokenToken(token._id)).resolves.toBeDefined();
    await expect(client.genTokenToken(token._id)).rejects.toHaveProperty(
      "code",
      ErrorCodes.TOKEN_MAX_GEN
    );
  });

  it("should increase generation field at each generation", async () => {
    const token = await Token.create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 3,
    });

    expect(token._generation).toBe(0);

    await expect(client.genTokenToken(token._id)).resolves.toBeDefined();

    // @ts-ignore
    Token.getAdapter().instancesMap.delete(token._id);
    const updatedToken = await Token.get(token._id);

    expect(updatedToken._generation).toBe(1);
  });

  it("should emit update generation event on socket", async () => {
    const TokenOnSocket = clientWithSocket.getModel(Token);

    expect(TokenOnSocket.getAdapter().base).toBe(
      clientWithSocket.getClientAdapter()
    );

    // await TokenOnSocket.initialize(true);

    const token = await TokenOnSocket.create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 2,
    });

    const fetchPromise = fetchWatcher(TokenOnSocket, {
      _id: token._id,
      operation: "update",
    });

    expect(token._generation).toBe(0);

    await expect(client.genTokenToken(token._id)).resolves.toBeDefined();

    await expect(fetchPromise).resolves.toBeTruthy();

    // expect(token._generation).toBe(1);

    // await expect(client.genTokenToken(token._id)).resolves.toBeDefined();

    // expect(token._generation).toBe(2);

    // await expect(client.genTokenToken(token._id)).rejects.toHaveProperty(
    //   "code",
    //   ErrorCodes.TOKEN_MAX_GEN
    // );

    // expect(token._generation).toBe(2);
  });
});
