import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";

// Single-login gate for v0: HTTP Basic Auth against two env vars.
// The browser shows its own username/password prompt and remembers it.
// Replace with Supabase Auth if this ever needs more than one user.

export function proxy(request: NextRequest) {
  // The MCP endpoint checks its own bearer token (src/app/api/mcp/route.ts):
  // Claude can't answer a Basic Auth prompt. Exact match, so nothing else
  // slips past the gate.
  if (request.nextUrl.pathname === "/api/mcp") return NextResponse.next();

  const expectedUser = process.env.DASHBOARD_USER || "me";
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedPassword) {
    return new NextResponse(
      "DASHBOARD_PASSWORD is not set. Add it to .env.local (or your Vercel env vars).",
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);
    if (
      sep !== -1 &&
      safeEqual(user, expectedUser) &&
      safeEqual(password, expectedPassword)
    ) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="dashboard", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
