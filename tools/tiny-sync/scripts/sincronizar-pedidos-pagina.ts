/**
 * Sincroniza uma unica pagina de pedidos do Tiny.
 * Uso:
 *   npm run sync:tiny:pedidos:pagina -- --pagina=1
 *   npm run sync:tiny:pedidos:pagina -- --pagina=1 --regiao=europa
 */
import type { Database } from "../src/tipos/database.js";
import { sincronizarPaginaPedidosTiny } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

type RegiaoVenda = Database["public"]["Enums"]["tipo_regiao_enum"];

function lerArgs(): { pagina: number; regiaoVenda: RegiaoVenda } {
  const args = process.argv.slice(2);
  let pagina: number | null = null;
  let regiaoVenda: RegiaoVenda = "brasil";

  for (const arg of args) {
    const mPag = arg.match(/^--pagina=(\d+)$/);
    if (mPag?.[1]) pagina = Number.parseInt(mPag[1], 10);

    const mReg = arg.match(/^--regiao=(brasil|europa|outros)$/);
    if (mReg?.[1]) regiaoVenda = mReg[1] as RegiaoVenda;
  }

  if (pagina === null) {
    throw new Error("Informe a pagina com --pagina=<numero>. Exemplo: --pagina=1");
  }

  return { pagina, regiaoVenda };
}

async function main(): Promise<void> {
  const { pagina, regiaoVenda } = lerArgs();
  const stats = await sincronizarPaginaPedidosTiny(pagina, regiaoVenda);
  logger.info("Resumo da pagina de pedidos sincronizada", {
    pagina,
    regiaoVenda,
    ...(stats as unknown as Record<string, unknown>),
  });
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao da pagina de pedidos falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
