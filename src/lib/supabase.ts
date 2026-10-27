import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client. It uses the SECRET key, so it must never be
// imported from a "use client" file. Env vars deliberately have no
// NEXT_PUBLIC_ prefix, so Next.js won't ship them to the browser.

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;

  // Tolerate the "RESTful endpoint" form copied from the dashboard;
  // supabase-js appends /rest/v1 itself.
  const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
