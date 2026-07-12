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
import { upsertOrdemCompraTinyPorItem } from "../supabase/repositorios/ordensCompra.js";
import { obterOuCriarClientePorPedido, upsertClienteCompletoPorContato } from "../supabase/repositorios/clientes.js";
import {
  substituirItensVenda,
  substituirParcelasVenda,
  upsertVendaPorTiny,
} from "../supabase/repositorios/vendas.js";
import {
  ENDPOINTS_TINY,
  iterarContatosTiny,
  iterarTodasAsPaginasPedidosTiny,
  iterarTodasAsPaginasTiny,
  listarContatosTiny,
  listarPedidosTiny,
  listarProdutosTiny,
  obterContatoTiny,
  obterPedidoTiny,
  obterProdutoTiny,
} from "./clienteTiny.js";
import { resolverFornecedorDoProduto } from "./resolverFornecedor.js";
import { parseProdutoTiny } from "./tinyParser.js";
import { parsePedidoTiny } from "./tinyParserPedidos.js";
import {
  contatoDetalheEhCliente,
  contatoDetalheEhFornecedor,
  contatoResumoEhCliente,
  contatoResumoEhFornecedor,
  parseClienteTiny,
  parseFornecedorTiny,
} from "./tinyParserContatos.js";
import type { Database } from "../../tipos/database.js";
import type { TinyPedidoDetalhe, TinyProdutoDetalhe } from "./tinyTipos.js";

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

  const { id: idItem, resultado } = await upsertItemEstoquePorTiny(supabase, parsed.item, {
    idModeloProduto: idModelo,
    idFornecedor,
    idLocalEstoque,
  });

  await upsertOrdemCompraTinyPorItem(supabase, idItem, parsed.item, {
    idFornecedor,
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

export async function sincronizarClientesTiny(
  opcoes: {
    paginaInicial?: number;
    limitePaginas?: number | null;
    paisPadrao?: string;
  } = {},
): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const paginaInicial = opcoes.paginaInicial ?? 1;
  const limitePaginas = opcoes.limitePaginas ?? null;
  const paisPadrao = opcoes.paisPadrao ?? "Brasil";

  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "contatos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaContatos,
  });

  logger.info("Iniciando sincronizacao de clientes", {
    paginaInicial,
    limitePaginas,
    paisPadrao,
    delayMs: env.tiny.delayMs,
  });

  let paginasProcessadas = 0;
  try {
    for await (const bloco of iterarContatosTiny({ tipo: "C" })) {
      if (bloco.pagina < paginaInicial) continue;
      paginasProcessadas += 1;

      const clientes = bloco.contatos.filter(contatoResumoEhCliente);
      logger.info("Processando pagina de clientes", {
        pagina: bloco.pagina,
        numeroPaginas: bloco.numeroPaginas,
        contatosNaPagina: bloco.contatos.length,
        clientesNaPagina: clientes.length,
        paisPadrao,
      });
      stats.recebidos += clientes.length;
      stats.ignorados += bloco.contatos.length - clientes.length;

      for (const resumo of clientes) {
        try {
          await dormir(env.tiny.delayMs);
          let parsed;
          try {
            const detalhe = await obterContatoTiny(resumo.id);
            if (!contatoDetalheEhCliente(detalhe)) {
              stats.ignorados += 1;
              continue;
            }
            parsed = parseClienteTiny(detalhe);
          } catch (erroObter) {
            // Alguns ids falham no obter (codigo 20); usa o resumo da listagem.
            const mensagemObter =
              erroObter instanceof Error
                ? erroObter.message
                : typeof erroObter === "object" && erroObter && "message" in erroObter
                  ? String((erroObter as { message: unknown }).message)
                  : String(erroObter);
            logger.warn("contato.obter falhou; usando resumo da pesquisa", {
              idTiny: resumo.id,
              mensagem: mensagemObter,
            });
            if (!contatoResumoEhCliente(resumo)) {
              stats.ignorados += 1;
              continue;
            }
            parsed = parseClienteTiny(resumo as unknown as Parameters<typeof parseClienteTiny>[0]);
          }
          const resultado = await upsertClienteCompletoPorContato(
            supabase,
            parsed,
            paisPadrao,
          );
          if (resultado.operacao === "criado") stats.criados += 1;
          else stats.atualizados += 1;
        } catch (erro) {
          stats.erros += 1;
          const mensagem =
            erro instanceof Error
              ? erro.message
              : typeof erro === "object" && erro && "message" in erro
                ? String((erro as { message: unknown }).message)
                : JSON.stringify(erro);
          stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
          logger.error("Falha ao sincronizar cliente", {
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
      "Sincronizacao de clientes concluida",
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

function normalizarNomeBusca(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toLowerCase();
}

function mensagemErroSync(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "object" && erro && "message" in erro) {
    return String((erro as { message: unknown }).message);
  }
  return JSON.stringify(erro);
}

/**
 * Enriquece apenas clientes vinculados a vendas da regiao informada,
 * buscando o contato completo no Tiny pelo nome.
 */
export async function sincronizarClientesVinculadosAVendasTiny(
  opcoes: {
    regiaoVenda?: Database["public"]["Enums"]["tipo_regiao_enum"];
    paisPadrao?: string;
    limite?: number | null;
  } = {},
): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const regiaoVenda = opcoes.regiaoVenda ?? "europa";
  const paisPadrao =
    opcoes.paisPadrao ??
    (regiaoVenda === "europa" ? "Europa" : regiaoVenda === "outros" ? "Outros" : "Brasil");
  const limite = opcoes.limite ?? null;

  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "contatos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaContatos,
  });

  logger.info("Iniciando sync de clientes vinculados a vendas", {
    regiaoVenda,
    paisPadrao,
    limite,
    delayMs: env.tiny.delayMs,
  });

  try {
    const { data: vendas, error } = await supabase
      .from("vendas")
      .select("id_cliente, nome_cliente")
      .eq("regiao_venda", regiaoVenda)
      .not("nome_cliente", "is", null);

    if (error) throw error;

    const porNome = new Map<string, { idCliente: string | null; nome: string }>();
    for (const v of vendas ?? []) {
      const nome = (v.nome_cliente ?? "").trim();
      if (!nome) continue;
      const chave = normalizarNomeBusca(nome);
      const atual = porNome.get(chave);
      if (!atual) {
        porNome.set(chave, { idCliente: v.id_cliente, nome });
      } else if (!atual.idCliente && v.id_cliente) {
        atual.idCliente = v.id_cliente;
      }
    }

    let lista = [...porNome.values()];
    if (limite !== null) lista = lista.slice(0, limite);
    stats.recebidos = lista.length;

    logger.info("Clientes unicos encontrados nas vendas", {
      total: lista.length,
      regiaoVenda,
    });

    for (const item of lista) {
      try {
        await dormir(env.tiny.delayMs);
        const pesquisa = await listarContatosTiny(1, {
          tipo: "C",
          pesquisa: item.nome,
        });
        const candidatos = (pesquisa.contatos ?? [])
          .map((c) => c.contato)
          .filter((c): c is NonNullable<typeof c> => Boolean(c));

        const alvo = normalizarNomeBusca(item.nome);
        const resumo =
          candidatos.find((c) => normalizarNomeBusca(c.nome ?? "") === alvo) ??
          candidatos[0] ??
          null;

        if (!resumo?.id) {
          stats.ignorados += 1;
          logger.warn("Contato nao encontrado no Tiny para cliente da venda", {
            nome: item.nome,
          });
          continue;
        }

        await dormir(env.tiny.delayMs);
        let parsed;
        try {
          const detalhe = await obterContatoTiny(resumo.id);
          parsed = parseClienteTiny(detalhe);
        } catch (erroObter) {
          logger.warn("contato.obter falhou; usando resumo da pesquisa", {
            idTiny: resumo.id,
            mensagem: mensagemErroSync(erroObter),
          });
          parsed = parseClienteTiny(
            resumo as unknown as Parameters<typeof parseClienteTiny>[0],
          );
        }

        const resultado = await upsertClienteCompletoPorContato(
          supabase,
          parsed,
          paisPadrao,
          { idPreferido: item.idCliente },
        );
        if (resultado.operacao === "criado") stats.criados += 1;
        else stats.atualizados += 1;
      } catch (erro) {
        stats.erros += 1;
        const mensagem = mensagemErroSync(erro);
        stats.errosDetalhe.push({ idTiny: item.nome, mensagem });
        logger.error("Falha ao sincronizar cliente da venda", {
          nome: item.nome,
          mensagem,
        });
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
      "Sync de clientes vinculados a vendas concluida",
      stats as unknown as Record<string, unknown>,
    );
    return stats;
  } catch (erro) {
    const mensagem = mensagemErroSync(erro);
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

async function persistirPedidoTiny(
  pedido: TinyPedidoDetalhe,
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"] = "brasil",
): Promise<"criado" | "atualizado"> {
  const supabase = obterClienteSupabase();
  const parsed = parsePedidoTiny(pedido, regiaoVenda);

  const resultadoCliente = await obterOuCriarClientePorPedido(
    supabase,
    pedido.cliente,
    regiaoVenda,
  );
  const idCliente = resultadoCliente?.idCliente ?? null;
  const idEnderecoCliente = resultadoCliente?.idEndereco ?? null;
  const { id: idVenda, resultado } = await upsertVendaPorTiny(
    supabase,
    parsed,
    idCliente,
    idEnderecoCliente,
  );
  await substituirItensVenda(supabase, idVenda, parsed.itens);
  await substituirParcelasVenda(supabase, idVenda, parsed.parcelas);

  return resultado;
}

export async function sincronizarPedidoPorId(
  idTiny: string,
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"] = "brasil",
): Promise<{
  status: "sucesso" | "erro";
  resultado?: "criado" | "atualizado";
  mensagemErro?: string;
}> {
  const supabase = obterClienteSupabase();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "pedido_detalhe",
    endpointTiny: ENDPOINTS_TINY.obterPedido,
  });

  try {
    const pedido = await obterPedidoTiny(idTiny);
    const resultado = await persistirPedidoTiny(pedido, regiaoVenda);
    await finalizarLogSync(supabase, log.id, {
      status: "sucesso",
      quantidadeRecebida: 1,
      quantidadeCriada: resultado === "criado" ? 1 : 0,
      quantidadeAtualizada: resultado === "atualizado" ? 1 : 0,
    });
    logger.info("Pedido sincronizado", { idTiny, resultado, regiaoVenda });
    return { status: "sucesso", resultado };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await finalizarLogSync(supabase, log.id, {
      status: "erro",
      mensagemErro: mensagem,
    });
    logger.error("Falha ao sincronizar pedido", { idTiny, mensagem });
    return { status: "erro", mensagemErro: mensagem };
  }
}

export async function sincronizarPaginaPedidosTiny(
  pagina: number,
  regiaoVenda: Database["public"]["Enums"]["tipo_regiao_enum"] = "brasil",
): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "pedidos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaPedidos,
    pagina,
  });

  try {
    const retorno = await listarPedidosTiny(pagina);
    const lista = (retorno.pedidos ?? []).map((p) => p.pedido);
    stats.recebidos = lista.length;

    for (const resumo of lista) {
      try {
        await dormir(env.tiny.delayMs);
        const detalhe = await obterPedidoTiny(resumo.id);
        const resultado = await persistirPedidoTiny(detalhe, regiaoVenda);
        if (resultado === "criado") stats.criados += 1;
        else stats.atualizados += 1;
      } catch (erro) {
        stats.erros += 1;
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
        logger.error("Falha em pedido da pagina", { idTiny: resumo.id, mensagem });
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

export async function sincronizarPedidosTiny(
  opcoes: {
    paginaInicial?: number;
    limitePaginas?: number | null;
    regiaoVenda?: Database["public"]["Enums"]["tipo_regiao_enum"];
  } = {},
): Promise<EstatisticasSync> {
  const supabase = obterClienteSupabase();
  const stats = estatisticasVazias();
  const paginaInicial = opcoes.paginaInicial ?? 1;
  const limitePaginas = opcoes.limitePaginas ?? null;
  const regiaoVenda = opcoes.regiaoVenda ?? "brasil";

  const log = await iniciarLogSync(supabase, {
    tipoSincronizacao: "pedidos_listagem",
    endpointTiny: ENDPOINTS_TINY.pesquisaPedidos,
  });

  logger.info("Iniciando sincronizacao de pedidos do Tiny", {
    paginaInicial,
    limitePaginas,
    regiaoVenda,
    delayMs: env.tiny.delayMs,
  });

  let paginasProcessadas = 0;
  try {
    for await (const bloco of iterarTodasAsPaginasPedidosTiny()) {
      if (bloco.pagina < paginaInicial) continue;
      paginasProcessadas += 1;

      logger.info("Processando pagina de pedidos", {
        pagina: bloco.pagina,
        numeroPaginas: bloco.numeroPaginas,
        pedidosNaPagina: bloco.pedidos.length,
        regiaoVenda,
      });
      stats.recebidos += bloco.pedidos.length;

      for (const resumo of bloco.pedidos) {
        try {
          await dormir(env.tiny.delayMs);
          const detalhe = await obterPedidoTiny(resumo.id);
          const resultado = await persistirPedidoTiny(detalhe, regiaoVenda);
          if (resultado === "criado") stats.criados += 1;
          else stats.atualizados += 1;
        } catch (erro) {
          stats.erros += 1;
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          stats.errosDetalhe.push({ idTiny: resumo.id, mensagem });
          logger.error("Falha ao sincronizar pedido", { idTiny: resumo.id, mensagem });
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
      "Sincronizacao de pedidos concluida",
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
