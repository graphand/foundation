"use client";

import { useProject } from "@/lib/context/project";
import { getClientGraphandClient } from "@/lib/graphand";
import { useEffect, useState } from "react";
import type { Client } from "@graphand/client";

export function useGraphandClient() {
  const { projectSubdomain, environment } = useProject();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    setClient(getClientGraphandClient(projectSubdomain, environment));
  }, [projectSubdomain, environment]);

  return client;
}
