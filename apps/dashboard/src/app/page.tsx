import { ExampleClient } from "@/components/example-client";
import { getServerGraphandClient } from "@/lib/graphand";

export default async function Home() {
  const client = await getServerGraphandClient();

  return (
    <div>
      Client: {client.options.project} - {client.options.environment}
      <ExampleClient />
    </div>
  );
}
