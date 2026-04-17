/**
 * Script tecnico manual (uso em dev / ops interno).
 * NAO deve ser exposto no front-end.
 *
 * Uso:
 *   npm run sync:tiny
 *   npm run sync:tiny -- --pagina-inicial=1 --limite-paginas=2
 */
import { sincronizarProdutosTiny } from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

function lerArgsCli(): { paginaInicial: number; limitePaginas: number | null } {
  const args = process.argv.slice(2);
  let paginaInicial = 1;
  let limitePaginas: number | null = null;

  for (const arg of args) {
    const mPag = arg.match(/^--pagina-inicial=(\d+)$/);
    if (mPag?.[1]) paginaInicial = Number.parseInt(mPag[1], 10);

    const mLim = arg.match(/^--limite-paginas=(\d+)$/);
    if (mLim?.[1]) limitePaginas = Number.parseInt(mLim[1], 10);
  }

  return { paginaInicial, limitePaginas };
}

async function main(): Promise<void> {
  const { paginaInicial, limitePaginas } = lerArgsCli();
  const stats = await sincronizarProdutosTiny({ paginaInicial, limitePaginas });
  logger.info("Resumo final da sincronizacao", stats as unknown as Record<string, unknown>);
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
