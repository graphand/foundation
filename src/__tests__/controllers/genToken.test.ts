import Client from "../../lib/Client";
import { Token, ErrorCodes } from "@graphand/core";
import { fetchWatcher, generateRandomString } from "../../lib/test-utils";
import { ObjectId } from "bson";
import FetchError from "../../lib/FetchError";

describe("controller genToken", () => {
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
    const token = await client.getModel(Token).create({
      name: generateRandomString(),
      role: roleId,
    });

    const accessToken = await client.genToken(token._id);
    expect(typeof accessToken).toBe("string");
  });

  it("should throw error if token is not valid", async () => {
    const promise = client.genToken(String(new ObjectId()));

    await expect(promise).rejects.toThrow(FetchError);
    await expect(promise).rejects.toHaveProperty("code", ErrorCodes.NOT_FOUND);
  });

  it("should throw error if maxGen is reached", async () => {
    const token = await client.getModel(Token).create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 3,
    });

    await expect(client.genToken(token._id)).resolves.toBeDefined();
    await expect(client.genToken(token._id)).resolves.toBeDefined();
    await expect(client.genToken(token._id)).resolves.toBeDefined();
    await expect(client.genToken(token._id)).rejects.toHaveProperty(
      "code",
      ErrorCodes.TOKEN_MAX_GEN
    );
  });

  it("should increase generation field at each generation", async () => {
    const token = await client.getModel(Token).create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 3,
    });

    expect(token.generation).toBe(0);

    await expect(client.genToken(token._id)).resolves.toBeDefined();

    // @ts-ignore
    client.getModel(Token).__adapter.instancesMap.delete(token._id);
    const updatedToken = await client.getModel(Token).get(token._id);

    expect(updatedToken.generation).toBe(1);
  });

  it("should emit update generation event on socket", async () => {
    const token = await clientWithSocket.getModel(Token).create({
      name: generateRandomString(),
      role: roleId,
      maxGen: 2,
    });

    const fetchPromise = fetchWatcher(
      clientWithSocket.getModel(Token),
      token._id,
      "update"
    );

    expect(token.generation).toBe(0);

    await expect(client.genToken(token._id)).resolves.toBeDefined();

    await expect(fetchPromise).resolves.toBeTruthy();

    expect(token.generation).toBe(1);

    await expect(client.genToken(token._id)).resolves.toBeDefined();

    expect(token.generation).toBe(2);

    await expect(client.genToken(token._id)).rejects.toHaveProperty(
      "code",
      ErrorCodes.TOKEN_MAX_GEN
    );

    expect(token.generation).toBe(2);
  });
});
