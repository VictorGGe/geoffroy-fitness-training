"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Client Supabase côté navigateur (singleton). Toutes les requêtes sont filtrées par RLS. */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_KEY,
    );
  }
  return browserClient;
}
