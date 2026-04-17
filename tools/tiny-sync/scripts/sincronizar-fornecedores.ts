/**
 * Script tecnico manual (uso em dev / ops interno).
 * NAO deve ser exposto no front-end.
 *
 * Sincroniza fornecedores a partir do endpoint /contatos.pesquisa.php + /contato.obter.php
 * do Tiny. Apenas contatos com tipos_contato contendo "Fornecedor" sao gravados.
 *
 * Uso:
 *   npm run sync:tiny:fornecedores
 *   npm run sync:tiny:fornecedores -- --pagina-inicial=1 --limite-paginas=2
 *   npm run sync:tiny:fornecedores -- --id=817357339
 */
import {
  sincronizarFornecedorPorId,
  sincronizarFornecedoresTiny,
} from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

interface ArgsCli {
  paginaInicial: number;
  limitePaginas: number | null;
  idUnico: string | null;
}

function lerArgsCli(): ArgsCli {
  const args = process.argv.slice(2);
  let paginaInicial = 1;
  let limitePaginas: number | null = null;
  let idUnico: string | null = null;

  for (const arg of args) {
    const mPag = arg.match(/^--pagina-inicial=(\d+)$/);
    if (mPag?.[1]) paginaInicial = Number.parseInt(mPag[1], 10);

    const mLim = arg.match(/^--limite-paginas=(\d+)$/);
    if (mLim?.[1]) limitePaginas = Number.parseInt(mLim[1], 10);

    const mId = arg.match(/^--id=(.+)$/);
    if (mId?.[1]) idUnico = mId[1].trim();
  }

  return { paginaInicial, limitePaginas, idUnico };
}

async function main(): Promise<void> {
  const { paginaInicial, limitePaginas, idUnico } = lerArgsCli();

  if (idUnico) {
    const resultado = await sincronizarFornecedorPorId(idUnico);
    logger.info("Resumo da sincronizacao individual", {
      idTiny: idUnico,
      ...(resultado as unknown as Record<string, unknown>),
    });
    return;
  }

  const stats = await sincronizarFornecedoresTiny({ paginaInicial, limitePaginas });
  logger.info(
    "Resumo final da sincronizacao de fornecedores",
    stats as unknown as Record<string, unknown>,
  );
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao de fornecedores falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
