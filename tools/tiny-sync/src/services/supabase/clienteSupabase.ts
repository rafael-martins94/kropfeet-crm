import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import type { Database } from "../../tipos/database.js";

export type SupabaseAppClient = SupabaseClient<Database, "public">;

let instancia: SupabaseAppClient | null = null;

export function obterClienteSupabase(): SupabaseAppClient {
  if (instancia) return instancia;
  instancia = createClient<Database>(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "X-Client-Info": "kropfeet-crm-sync/0.1.0" },
    },
  });
  return instancia;
}
