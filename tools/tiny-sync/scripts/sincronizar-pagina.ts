/**
 * Sincroniza uma unica pagina do Tiny.
 * Uso:
 *   npm run sync:tiny:pagina -- --pagina=1
 */
import { sincronizarPaginaTiny } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

function lerPagina(): number {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--pagina="));
  const match = arg?.match(/^--pagina=(\d+)$/);
  if (!match?.[1]) {
    throw new Error("Informe a pagina com --pagina=<numero>. Exemplo: --pagina=1");
  }
  return Number.parseInt(match[1], 10);
}

async function main(): Promise<void> {
  const pagina = lerPagina();
  const stats = await sincronizarPaginaTiny(pagina);
  logger.info("Resumo da pagina sincronizada", {
    pagina,
    ...(stats as unknown as Record<string, unknown>),
  });
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao da pagina falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
