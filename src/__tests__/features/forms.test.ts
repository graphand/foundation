import { executeController } from "../../lib/utils";
import { getClient, getFile } from "../../lib/test-utils";
import { FormProcessEvent, controllersMap } from "@graphand/core";
import Client from "../../lib/Client";

describe("test forms", () => {
  it("should be able to get forms event when sending file", async () => {
    const client: Client = getClient({
      sockets: ["project"],
    });

    await new Promise((resolve) => setTimeout(resolve, 200)); // await socket to connect

    const file = await getFile("sample.png");
    const events: Array<FormProcessEvent> = [];

    const unsubscribe = client.formsEvent.subscribe(
      Array.prototype.push.bind(events)
    );

    const res = await executeController(client, controllersMap.infos, {
      sendAsFormData: true,
      body: {
        file,
      },
    });

    expect(res).toBeTruthy();

    unsubscribe();

    const startEvent = events.find((e: FormProcessEvent) => e.type === "start");
    const endEvent = events.find((e: FormProcessEvent) => e.type === "end");

    expect(startEvent).toBeTruthy();
    expect(endEvent).toBeTruthy();
    expect(endEvent.files).toBeInstanceOf(Array);
    expect(endEvent.files).toContain("sample.png");
  });
});
