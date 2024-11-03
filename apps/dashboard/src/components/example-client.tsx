"use client";

import { useGraphandClient } from "@/hooks/useGraphandClient";

export function ExampleClient() {
  const client = useGraphandClient();

  if (!client) {
    return null;
  }

  return (
    <div>
      Client: {client.options.project} - {client.options.environment}
    </div>
  );
}
