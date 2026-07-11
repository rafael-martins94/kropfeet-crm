/**
 * Sincroniza os pedidos (ordens de venda) do Tiny.
 * Script tecnico manual (uso em dev / ops interno). NAO expor no front-end.
 *
 * Uso:
 *   npm run sync:tiny:pedidos
 *   npm run sync:tiny:pedidos -- --pagina-inicial=1 --limite-paginas=2
 *   npm run sync:tiny:pedidos -- --regiao=europa
 */
import type { Database } from "../src/tipos/database.js";
import { sincronizarPedidosTiny } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

type RegiaoVenda = Database["public"]["Enums"]["tipo_regiao_enum"];

function lerArgsCli(): {
  paginaInicial: number;
  limitePaginas: number | null;
  regiaoVenda: RegiaoVenda;
} {
  const args = process.argv.slice(2);
  let paginaInicial = 1;
  let limitePaginas: number | null = null;
  let regiaoVenda: RegiaoVenda = "brasil";

  for (const arg of args) {
    const mPag = arg.match(/^--pagina-inicial=(\d+)$/);
    if (mPag?.[1]) paginaInicial = Number.parseInt(mPag[1], 10);

    const mLim = arg.match(/^--limite-paginas=(\d+)$/);
    if (mLim?.[1]) limitePaginas = Number.parseInt(mLim[1], 10);

    const mReg = arg.match(/^--regiao=(brasil|europa|outros)$/);
    if (mReg?.[1]) regiaoVenda = mReg[1] as RegiaoVenda;
  }

  return { paginaInicial, limitePaginas, regiaoVenda };
}

async function main(): Promise<void> {
  const { paginaInicial, limitePaginas, regiaoVenda } = lerArgsCli();
  const stats = await sincronizarPedidosTiny({
    paginaInicial,
    limitePaginas,
    regiaoVenda,
  });
  logger.info("Resumo final da sincronizacao de pedidos", {
    regiaoVenda,
    ...(stats as unknown as Record<string, unknown>),
  });
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao de pedidos falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
