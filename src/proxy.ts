import { NextResponse, type NextRequest } from "next/server";

// Single-login gate for v0: HTTP Basic Auth against two env vars.
// The browser shows its own username/password prompt and remembers it.
// Replace with Supabase Auth if this ever needs more than one user.

export function proxy(request: NextRequest) {
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

// Constant-time-ish comparison so response timing doesn't leak the password.
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
