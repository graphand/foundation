import { ExampleClient } from "@/components/example-client";
import { getServerGraphandClient } from "@/lib/graphand";

export default async function DashboardsPage() {
  const client = await getServerGraphandClient();

  return (
    <div>
      Dashboards: {client.options.project} - {client.options.environment}
      <ExampleClient />
    </div>
  );
}
