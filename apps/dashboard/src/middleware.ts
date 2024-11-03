import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import env from "./lib/env";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");

  if (!host?.includes(env.APP_HOSTNAME)) {
    return NextResponse.error();
  }

  const hostURL = new URL("https://" + host);
  const [_projectSubdomain, _environment] = hostURL.hostname.replace(env.APP_HOSTNAME, "").split(".");

  const projectSubdomain = _projectSubdomain || "";
  const environment = _environment || "master";

  const response = projectSubdomain
    ? NextResponse.rewrite(new URL(`/${projectSubdomain}/${environment}${request.nextUrl.pathname}`, request.url))
    : NextResponse.next();

  response.headers.set("x-project-subdomain", projectSubdomain);
  response.headers.set("x-environment", environment);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
