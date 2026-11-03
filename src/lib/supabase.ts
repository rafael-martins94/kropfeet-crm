import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
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
      // A trava padrão (navigator.locks) é compartilhada entre as abas: uma aba em segundo
      // plano ou uma extensão segurando a trava fazia cada acesso à sessão esperar 5 s.
      // Com a trava por aba, uma aba nunca espera a outra.
      lock: processLock,
    },
    global: {
      headers: {
        "X-Client-Info": "kropfeet-web/0.1.0",
      },
    },
  },
);
