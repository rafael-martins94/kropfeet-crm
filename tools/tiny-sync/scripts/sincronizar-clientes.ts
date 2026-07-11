/**
 * Sincroniza clientes a partir do Tiny.
 *
 * Uso:
 *   # Todos os contatos tipo Cliente
 *   npm run sync:tiny:clientes -- --pais=Europa
 *
 *   # Apenas clientes vinculados a ordens de venda da regiao
 *   npm run sync:tiny:clientes -- --somente-vendas --regiao=europa --pais=Europa
 */
import type { Database } from "../src/tipos/database.js";
import {
  sincronizarClientesTiny,
  sincronizarClientesVinculadosAVendasTiny,
} from "../src/services/tiny/tinySincronizacao.js";
import { logger } from "../src/utils/logger.js";

type RegiaoVenda = Database["public"]["Enums"]["tipo_regiao_enum"];

function lerArgsCli(): {
  paginaInicial: number;
  limitePaginas: number | null;
  paisPadrao: string;
  somenteVendas: boolean;
  regiaoVenda: RegiaoVenda;
  limite: number | null;
} {
  const args = process.argv.slice(2);
  let paginaInicial = 1;
  let limitePaginas: number | null = null;
  let paisPadrao = "Brasil";
  let somenteVendas = false;
  let regiaoVenda: RegiaoVenda = "europa";
  let limite: number | null = null;

  for (const arg of args) {
    if (arg === "--somente-vendas") somenteVendas = true;

    const mPag = arg.match(/^--pagina-inicial=(\d+)$/);
    if (mPag?.[1]) paginaInicial = Number.parseInt(mPag[1], 10);

    const mLim = arg.match(/^--limite-paginas=(\d+)$/);
    if (mLim?.[1]) limitePaginas = Number.parseInt(mLim[1], 10);

    const mLimite = arg.match(/^--limite=(\d+)$/);
    if (mLimite?.[1]) limite = Number.parseInt(mLimite[1], 10);

    const mPais = arg.match(/^--pais=(.+)$/);
    if (mPais?.[1]) paisPadrao = mPais[1].trim();

    const mReg = arg.match(/^--regiao=(brasil|europa|outros)$/);
    if (mReg?.[1]) regiaoVenda = mReg[1] as RegiaoVenda;
  }

  return { paginaInicial, limitePaginas, paisPadrao, somenteVendas, regiaoVenda, limite };
}

async function main(): Promise<void> {
  const args = lerArgsCli();

  if (args.somenteVendas) {
    const stats = await sincronizarClientesVinculadosAVendasTiny({
      regiaoVenda: args.regiaoVenda,
      paisPadrao: args.paisPadrao,
      limite: args.limite,
    });
    logger.info("Resumo final (clientes vinculados a vendas)", {
      regiaoVenda: args.regiaoVenda,
      paisPadrao: args.paisPadrao,
      ...(stats as unknown as Record<string, unknown>),
    });
    return;
  }

  const stats = await sincronizarClientesTiny({
    paginaInicial: args.paginaInicial,
    limitePaginas: args.limitePaginas,
    paisPadrao: args.paisPadrao,
  });
  logger.info("Resumo final da sincronizacao de clientes", {
    paisPadrao: args.paisPadrao,
    ...(stats as unknown as Record<string, unknown>),
  });
}

main().catch((erro: unknown) => {
  logger.error("Sincronizacao de clientes falhou", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  process.exit(1);
});
