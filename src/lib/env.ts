function readRequired(name: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Configure o arquivo web/.env.local.`,
    );
  }
  return value.trim();
}

export const env = {
  supabase: {
    url: readRequired("VITE_SUPABASE_URL"),
    anonKey: readRequired("VITE_SUPABASE_ANON_KEY"),
  },
} as const;

export type AppEnv = typeof env;
