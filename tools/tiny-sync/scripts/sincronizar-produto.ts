/**
 * Sincroniza um unico produto do Tiny pelo id_tiny.
 * Uso:
 *   npm run sync:tiny:produto -- --id=123456
 */
import { sincronizarProdutoPorId } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

function lerIdTiny(): string {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--id="));
  const match = arg?.match(/^--id=(.+)$/);
  if (!match?.[1]) {
    throw new Error("Informe o id do Tiny com --id=<id>. Exemplo: --id=123456");
  }
  return match[1];
}

async function main(): Promise<void> {
  const idTiny = lerIdTiny();
  const resultado = await sincronizarProdutoPorId(idTiny);
  logger.info("Resultado da sincronizacao individual", {
    idTiny,
    ...(resultado as unknown as Record<string, unknown>),
  });
  if (resultado.status === "erro") process.exit(1);
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao individual falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
