import { headers } from "next/headers";

export async function getProjectInfo() {
  const headersList = await headers();
  return {
    projectSubdomain: headersList.get("x-project-subdomain") || "",
    environment: headersList.get("x-environment") || "master",
  };
}
