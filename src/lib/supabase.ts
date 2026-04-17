import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Database } from "../types/database";

export type AppSupabaseClient = SupabaseClient<Database, "public">;

export const supabase: AppSupabaseClient = createClient<Database>(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "kropfeet.auth",
    },
    global: {
      headers: {
        "X-Client-Info": "kropfeet-web/0.1.0",
      },
    },
  },
);
