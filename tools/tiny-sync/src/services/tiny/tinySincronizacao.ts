import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { dormir } from "../../utils/retry.js";
import { obterClienteSupabase } from "../supabase/clienteSupabase.js";
import { obterOuCriarCategoria } from "../supabase/repositorios/categorias.js";
import { upsertFornecedorCompleto } from "../supabase/repositorios/fornecedores.js";
import { sincronizarImagensDoModelo } from "../supabase/repositorios/imagensModeloProduto.js";
import { upsertItemEstoquePorTiny } from "../supabase/repositorios/itensEstoque.js";
import { obterOuCriarLocalEstoque } from "../supabase/repositorios/locaisEstoque.js";
import {
  finalizarLogSync,
  iniciarLogSync,
} from "../supabase/repositorios/logsSincronizacao.js";
import { obterOuCriarMarca } from "../supabase/repositorios/marcas.js";
import { upsertModeloProduto } from "../supabase/repositorios/modelosProduto.js";
import {
  ENDPOINTS_TINY,
  iterarContatosTiny,
  iterarTodasAsPaginasTiny,
  listarProdutosTiny,
  obterContatoTiny,
  obterProdutoTiny,
} from "./clienteTiny.js";
import { resolverFornecedorDoProduto } from "./resolverFornecedor.js";
import { parseProdutoTiny } from "./tinyParser.js";
import {
  contatoDetalheEhFornecedor,
  contatoResumoEhFornecedor,
  parseFornecedorTiny,
} from "./tinyParserContatos.js";
import type { TinyProdutoDetalhe } from "./tinyTipos.js";

export interface EstatisticasSync {
  recebidos: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  errosDetalhe: Array<{ idTiny: string; mensagem: string }>;
}

function estatisticasVazias(): EstatisticasSync {
  return { recebidos: 0, criados: 0, atualizados: 0, ignorados: 0, erros: 0, errosDetalhe: [] };
}

async function persistirProdutoTiny(produto: TinyProdutoDetalhe): Promise<"criado" | "atualizado"> {
  const supabase = obterClienteSupabase();
  const parsed = parseProdutoTiny(produto);

  const idMarca = parsed.modelo.marca
    ? await obterOuCriarMarca(supabase, parsed.modelo.marca)
    : null;
  const idCategoria = parsed.modelo.categoria
    ? await obterOuCriarCategoria(supabase, parsed.modelo.categoria)
    : null;
  const idFornecedor = await resolverFornecedorDoProduto(supabase, parsed.fornecedor);
  const idLocalEstoque = parsed.localEstoque
    ? await obterOuCriarLocalEstoque(supabase, parsed.localEstoque)
    : null;

  const idModelo = await upsertModeloProduto(supabase, parsed.modelo, {
    idMarca,
    idCategoria,
  });

  if (parsed.imagens.length > 0) {
    const statsImagens = await sincronizarImagensDoModelo(
      supabase,
      idModelo,
      parsed.imagens,
    );
    logger.info("Imagens processadas", {
      idTiny: produto.id,
      idModelo,
      ...(statsImagens as unknown as Record<string, unknown>),
    });
  } else {
    const temPayloadImagem = Boolean(
      (produto as unknown as Record<string, unknown>).anexos ||
        (produto as unknown as Record<string, unknown>).imagens_externas ||
        (produto as unknown as Record<string, unknown>).imagens,
    );
    if (temPayloadImagem) {
      logger.warn("Produto com payload de imagem mas parser nao extraiu URLs", {
        idTiny: produto.id,
        anexos: (produto as unknown as Record<string, unknown>).anexos,
        imagens_externas: (produto as unknown as Record<string, unknown>).imagens_externas,
      });
    }
  }

  const { resultado } = await upsertItemEstoquePorTiny(supabase, parsed.item, {
    idModeloProduto: idModelo,
    idFornecedor,
    idLocalEstoque,
  });

  return resultado;
}

export async function sincronizarProdutoPorId(idTiny: string): Promise<{
  status: "sucesso" | "erro";
  resultado?: "criado" | "atualizado";
  mensagemErro?: string;
}> {
  const supabase = obterClienteSupabase();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "produto_detalhe",
    endpointTiny: ENDPOINTS_TINY.obterProduto,
  });

  try {
    const produto = await obterProdutoTiny(idTiny);
    const resultado = await persistirProdutoTiny(produto);
    await finalizarLogSync(supabase, log.id, {
      status: "sucesso",
      quantidadeRecebida: 1,
      quantidadeCriada: resultado === "criado" ? 1 : 0,
      quantidadeAtualizada: resultado === "atualizado" ? 1 : 0,
    });
    logger.info("Produto sincronizado", { idTiny, resultado });
    return { status: "sucesso", resultado };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
    });
    logger.error("Falha ao sincronizar produto", { idTiny, mensagem });
    return { status: "erro", mensagemErro: mensagem };
  }
}

export async function sincronizarPaginaTiny(pagina: number): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "produtos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaProdutos,
    pagina,
  });

  try {
    const retorno = await listarProdutosTiny(pagina);
    const lista = (retorno.produtos ?? []).map((p) => p.produto);
    stats.recebidos = lista.length;

    for (const resumo of lista) {
      try {
        await dormir(env.tiny.delayMs);
        const detalhe = await obterProdutoTiny(resumo.id);
        const resultado = await persistirProdutoTiny(detalhe);
        if (resultado === "criado") stats.criados += 1;
        else stats.atualizados += 1;
      } catch (erro) {
        stats.erros += 1;
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
        logger.error("Falha em item da pagina", { idTiny: resumo.id, mensagem });
      }
    }

    await finalizarLogSync(supabase, log.id, {
      status: stats.erros === 0 ? "sucesso" : "parcial",
      quantidadeRecebida: stats.recebidos,
      quantidadeCriada: stats.criados,
      quantidadeAtualizada: stats.atualizados,
      mensagemErro: stats.errosDetalhe.length > 0 ? JSON.stringify(stats.errosDetalhe) : null,
      pagina,
    });
    return stats;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
      pagina,
    });
    throw erro;
  }
}

export async function sincronizarProdutosTiny(opcoes: {
  paginaInicial?: number;
  limitePaginas?: number | null;
} = {}): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const paginaInicial = opcoes.paginaInicial ?? 1;
  const limitePaginas = opcoes.limitePaginas ?? null;

  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "produtos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaProdutos,
  });

  logger.info("Iniciando sincronizacao completa do Tiny", {
    paginaInicial,
    limitePaginas,
    delayMs: env.tiny.delayMs,
  });

  let paginasProcessadas = 0;
  try {
    for await (const bloco of iterarTodasAsPaginasTiny()) {
      if (bloco.pagina < paginaInicial) continue;
      paginasProcessadas += 1;

      logger.info("Processando pagina", {
        pagina: bloco.pagina,
        numeroPaginas: bloco.numeroPaginas,
        produtosNaPagina: bloco.produtos.length,
      });
      stats.recebidos += bloco.produtos.length;

      for (const resumo of bloco.produtos) {
        try {
          await dormir(env.tiny.delayMs);
          const detalhe = await obterProdutoTiny(resumo.id);
          const resultado = await persistirProdutoTiny(detalhe);
          if (resultado === "criado") stats.criados += 1;
          else stats.atualizados += 1;
        } catch (erro) {
          stats.erros += 1;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
          logger.error("Falha ao sincronizar item", { idTiny: resumo.id, mensagem });
        }
      }

      if (limitePaginas !== null && paginasProcessadas >= limitePaginas) {
        logger.info("Limite de paginas atingido, encerrando", { limitePaginas });
        break;
      }
    }

    await finalizarLogSync(supabase, log.id, {
      status: stats.erros === 0 ? "sucesso" : "parcial",
      quantidadeRecebida: stats.recebidos,
      quantidadeCriada: stats.criados,
      quantidadeAtualizada: stats.atualizados,
      mensagemErro:
        stats.errosDetalhe.length > 0
          ? JSON.stringify(stats.errosDetalhe.slice(0, 50))
          : null,
    });

    logger.info("Sincronizacao concluida", stats as unknown as Record<string, unknown>);
    return stats;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
      quantidadeRecebida: stats.recebidos,
      quantidadeCriada: stats.criados,
      quantidadeAtualizada: stats.atualizados,
    });
    throw erro;
  }
}

export async function sincronizarFornecedorPorId(idTiny: string): Promise<{
  status: "sucesso" | "erro" | "ignorado";
  operacao?: "criado" | "atualizado";
  mensagemErro?: string;
}> {
  const supabase = obterClienteSupabase();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "contato_detalhe",
    endpointTiny: ENDPOINTS_TINY.obterContato,
  });

  try {
    const contato = await obterContatoTiny(idTiny);
    if (!contatoDetalheEhFornecedor(contato)) {
      await finalizarLogSync(supabase, log.id, {
        status: "sucesso",
        quantidadeRecebida: 1,
      });
      logger.info("Contato ignorado (nao eh fornecedor)", { idTiny });
      return { status: "ignorado" };
    }

    const parsed = parseFornecedorTiny(contato);
    const resultado = await upsertFornecedorCompleto(supabase, parsed);

    await finalizarLogSync(supabase, log.id, {
      status: "sucesso",
      quantidadeRecebida: 1,
      quantidadeCriada: resultado.operacao === "criado" ? 1 : 0,
      quantidadeAtualizada: resultado.operacao === "atualizado" ? 1 : 0,
    });
    logger.info("Fornecedor sincronizado", {
      idTiny,
      operacao: resultado.operacao,
    });
    return { status: "sucesso", operacao: resultado.operacao };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
    });
    logger.error("Falha ao sincronizar fornecedor", { idTiny, mensagem });
    return { status: "erro", mensagemErro: mensagem };
  }
}

export async function sincronizarFornecedoresTiny(
  opcoes: {
    paginaInicial?: number;
    limitePaginas?: number | null;
  } = {},
): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const paginaInicial = opcoes.paginaInicial ?? 1;
  const limitePaginas = opcoes.limitePaginas ?? null;

  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "contatos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaContatos,
  });

  logger.info("Iniciando sincronizacao de fornecedores", {
    paginaInicial,
    limitePaginas,
    delayMs: env.tiny.delayMs,
  });

  let paginasProcessadas = 0;
  try {
    for await (const bloco of iterarContatosTiny({ tipo: "F" })) {
      if (bloco.pagina < paginaInicial) continue;
      paginasProcessadas += 1;

      const fornecedores = bloco.contatos.filter(contatoResumoEhFornecedor);
      logger.info("Processando pagina de contatos", {
        pagina: bloco.pagina,
        numeroPaginas: bloco.numeroPaginas,
        contatosNaPagina: bloco.contatos.length,
        fornecedoresNaPagina: fornecedores.length,
      });
      stats.recebidos += fornecedores.length;
      stats.ignorados += bloco.contatos.length - fornecedores.length;

      for (const resumo of fornecedores) {
        try {
          await dormir(env.tiny.delayMs);
          const detalhe = await obterContatoTiny(resumo.id);
          if (!contatoDetalheEhFornecedor(detalhe)) {
            stats.ignorados += 1;
            continue;
          }
          const parsed = parseFornecedorTiny(detalhe);
          const resultado = await upsertFornecedorCompleto(supabase, parsed);
          if (resultado.operacao === "criado") stats.criados += 1;
          else stats.atualizados += 1;
        } catch (erro) {
          stats.erros += 1;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
          logger.error("Falha ao sincronizar fornecedor", {
            idTiny: resumo.id,
            mensagem,
          });
        }
      }

      if (limitePaginas !== null && paginasProcessadas >= limitePaginas) {
        logger.info("Limite de paginas atingido, encerrando", { limitePaginas });
        break;
      }
    }

    await finalizarLogSync(supabase, log.id, {
      status: stats.erros === 0 ? "sucesso" : "parcial",
      quantidadeRecebida: stats.recebidos,
      quantidadeCriada: stats.criados,
      quantidadeAtualizada: stats.atualizados,
      mensagemErro:
        stats.errosDetalhe.length > 0
          ? JSON.stringify(stats.errosDetalhe.slice(0, 50))
          : null,
    });

    logger.info(
      "Sincronizacao de fornecedores concluida",
      stats as unknown as Record<string, unknown>,
    );
    return stats;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
      quantidadeRecebida: stats.recebidos,
      quantidadeCriada: stats.criados,
      quantidadeAtualizada: stats.atualizados,
    });
    throw erro;
  }
}
