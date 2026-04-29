import "dotenv/config";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${nome}. Confira o arquivo .env.`,
    );
  }
  return valor.trim();
}

function opcional(nome: string, padrao: string): string {
  const valor = process.env[nome];
  return valor && valor.trim() !== "" ? valor.trim() : padrao;
}

function inteiro(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  const n = Number.parseInt(bruto, 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

function booleano(nome: string, padrao: boolean): boolean {
  const bruto = process.env[nome];
  if (!bruto) return padrao;
  const v = bruto.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "sim";
}

export const env = {
  supabase: {
    url: exigir("SUPABASE_URL"),
    serviceRoleKey: exigir("SUPABASE_SERVICE_ROLE_KEY"),
    bucketImagens: opcional("SUPABASE_BUCKET_IMAGENS", "imagens-modelos"),
  },
  tiny: {
    token: exigir("TINY_API_TOKEN"),
    baseUrl: opcional("TINY_API_BASE_URL", "https://api.tiny.com.br/api2"),
    delayMs: inteiro("TINY_DELAY_MS", 2200),
    maxRetries: inteiro("TINY_MAX_RETRIES", 8),
    timeoutMs: inteiro("TINY_TIMEOUT_MS", 30000),
    /** Espera base (ms) entre retentativas quando a Tiny retorna API bloqueada / limite (cod. 6 ou 30). */
    esperaApiBloqueadaMs: inteiro("TINY_ESPERA_API_BLOQUEADA_MS", 60_000),
    esperaApiBloqueadaMaxMs: inteiro("TINY_ESPERA_API_BLOQUEADA_MAX_MS", 180_000),
    enriquecerFornecedorSobDemanda: booleano("TINY_ENRIQUECER_FORNECEDOR", true),
  },
  imagens: {
    habilitado: booleano("STORAGE_IMAGENS_HABILITADO", true),
    timeoutMs: inteiro("STORAGE_IMAGENS_TIMEOUT_MS", 20000),
    maxRetries: inteiro("STORAGE_IMAGENS_MAX_RETRIES", 2),
    tamanhoMaximoBytes: inteiro("STORAGE_IMAGENS_TAMANHO_MAXIMO_BYTES", 10 * 1024 * 1024),
  },
} as const;

export type AppEnv = typeof env;
