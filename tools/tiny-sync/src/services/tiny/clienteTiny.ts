import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { comRetry, dormir } from "../../utils/retry.js";
import {
  TinyApiError,
  type TinyContatoDetalhe,
  type TinyContatoResumo,
  type TinyEnvelope,
  type TinyProdutoDetalhe,
  type TinyProdutoListagem,
  type TinyRetornoObterContato,
  type TinyRetornoObterProduto,
  type TinyRetornoPesquisaContatos,
  type TinyRetornoPesquisaProdutos,
} from "./tinyTipos.js";

const ENDPOINTS = {
  pesquisaProdutos: "/produtos.pesquisa.php",
  obterProduto: "/produto.obter.php",
  pesquisaContatos: "/contatos.pesquisa.php",
  obterContato: "/contato.obter.php",
} as const;

const CODIGOS_ERRO_TEMPORARIOS = new Set([
  "6", // API ocupada
  "20", // request invalido (as vezes transiente)
  "30", // limite de requisicoes
]);

function montarUrl(endpoint: string): string {
  return `${env.tiny.baseUrl}${endpoint}`;
}

function eTemporario(erro: unknown): boolean {
  if (erro instanceof TinyApiError) return erro.temporario;
  return true;
}

async function chamarTiny<TRetorno>(
  endpoint: string,
  corpo: Record<string, string>,
): Promise<TRetorno> {
  const url = montarUrl(endpoint);
  const params = new URLSearchParams({
    token: env.tiny.token,
    formato: "JSON",
    ...corpo,
  });

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), env.tiny.timeoutMs);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controlador.signal,
    });
  } catch (erro) {
    clearTimeout(timeout);
    throw new TinyApiError({
      mensagem: `Falha de rede ao chamar ${endpoint}: ${
        erro instanceof Error ? erro.message : String(erro)
      }`,
      status: null,
      endpoint,
      temporario: true,
    });
  }
  clearTimeout(timeout);

  const textoBruto = await resposta.text();

  if (!resposta.ok) {
    throw new TinyApiError({
      mensagem: `HTTP ${resposta.status} em ${endpoint}`,
      status: resposta.status,
      endpoint,
      corpoBruto: textoBruto.slice(0, 2000),
      temporario: resposta.status >= 500 || resposta.status === 429,
    });
  }

  let json: TinyEnvelope<TRetorno & { status?: string; codigo_erro?: string; erros?: unknown[] }>;
  try {
    json = JSON.parse(textoBruto);
  } catch {
    throw new TinyApiError({
      mensagem: `Resposta nao-JSON em ${endpoint}`,
      status: resposta.status,
      endpoint,
      corpoBruto: textoBruto.slice(0, 2000),
      temporario: true,
    });
  }

  const retorno = json?.retorno;
  if (!retorno) {
    throw new TinyApiError({
      mensagem: `Payload sem campo "retorno" em ${endpoint}`,
      status: resposta.status,
      endpoint,
      corpoBruto: json,
    });
  }

  if (retorno.status && retorno.status !== "OK") {
    const codigoErro = retorno.codigo_erro ?? null;
    const temporario = codigoErro ? CODIGOS_ERRO_TEMPORARIOS.has(codigoErro) : false;
    const mensagemErros = Array.isArray(retorno.erros)
      ? retorno.erros
          .map((e) => (typeof e === "string" ? e : (e as { erro?: string })?.erro ?? ""))
          .filter(Boolean)
          .join("; ")
      : "";
    throw new TinyApiError({
      mensagem: `Tiny retornou erro em ${endpoint}: status=${retorno.status} codigo=${codigoErro ?? "?"} ${
        mensagemErros ? `- ${mensagemErros}` : ""
      }`,
      status: resposta.status,
      codigoErro,
      endpoint,
      corpoBruto: retorno,
      temporario,
    });
  }

  return retorno as TRetorno;
}

async function chamarTinyComRetry<TRetorno>(
  endpoint: string,
  corpo: Record<string, string>,
): Promise<TRetorno> {
  return comRetry(() => chamarTiny<TRetorno>(endpoint, corpo), {
    tentativas: env.tiny.maxRetries,
    delayInicialMs: 1500,
    fatorBackoff: 2,
    deveTentarNovamente: eTemporario,
    rotulo: endpoint,
  });
}

export async function listarProdutosTiny(
  pagina: number,
): Promise<TinyRetornoPesquisaProdutos> {
  logger.info("Tiny: listando produtos", { pagina });
  return chamarTinyComRetry<TinyRetornoPesquisaProdutos>(ENDPOINTS.pesquisaProdutos, {
    pagina: String(pagina),
  });
}

export async function obterProdutoTiny(idTiny: string): Promise<TinyProdutoDetalhe> {
  logger.info("Tiny: obtendo detalhe do produto", { idTiny });
  const retorno = await chamarTinyComRetry<TinyRetornoObterProduto>(
    ENDPOINTS.obterProduto,
    { id: idTiny },
  );
  if (!retorno.produto) {
    throw new TinyApiError({
      mensagem: `produto.obter.php nao retornou "produto" para id=${idTiny}`,
      status: null,
      endpoint: ENDPOINTS.obterProduto,
      corpoBruto: retorno,
    });
  }
  return retorno.produto;
}

export async function* iterarTodasAsPaginasTiny(): AsyncGenerator<{
  pagina: number;
  numeroPaginas: number;
  produtos: TinyProdutoListagem[];
  respostaBruta: TinyRetornoPesquisaProdutos;
}> {
  let paginaAtual = 1;
  let totalPaginas = 1;

  do {
    const retorno = await listarProdutosTiny(paginaAtual);
    const produtos = (retorno.produtos ?? [])
      .map((p) => p.produto)
      .filter((p): p is TinyProdutoListagem => Boolean(p));
    totalPaginas = Number(retorno.numero_paginas ?? 1);

    yield {
      pagina: paginaAtual,
      numeroPaginas: totalPaginas,
      produtos,
      respostaBruta: retorno,
    };

    paginaAtual += 1;
    if (paginaAtual <= totalPaginas) {
      await dormir(env.tiny.delayMs);
    }
  } while (paginaAtual <= totalPaginas);
}

export async function listarTodasAsPaginasTiny(): Promise<TinyProdutoListagem[]> {
  const acumulado: TinyProdutoListagem[] = [];
  for await (const bloco of iterarTodasAsPaginasTiny()) {
    acumulado.push(...bloco.produtos);
  }
  return acumulado;
}

export async function listarContatosTiny(
  pagina: number,
  filtros: { tipo?: "C" | "F" | "T"; pesquisa?: string } = {},
): Promise<TinyRetornoPesquisaContatos> {
  logger.info("Tiny: listando contatos", { pagina, ...filtros });
  const corpo: Record<string, string> = { pagina: String(pagina) };
  if (filtros.tipo) corpo.tipo = filtros.tipo;
  if (filtros.pesquisa) corpo.pesquisa = filtros.pesquisa;
  return chamarTinyComRetry<TinyRetornoPesquisaContatos>(
    ENDPOINTS.pesquisaContatos,
    corpo,
  );
}

export async function obterContatoTiny(idTiny: string): Promise<TinyContatoDetalhe> {
  logger.info("Tiny: obtendo detalhe do contato", { idTiny });
  const retorno = await chamarTinyComRetry<TinyRetornoObterContato>(
    ENDPOINTS.obterContato,
    { id: idTiny },
  );
  if (!retorno.contato) {
    throw new TinyApiError({
      mensagem: `contato.obter.php nao retornou "contato" para id=${idTiny}`,
      status: null,
      endpoint: ENDPOINTS.obterContato,
      corpoBruto: retorno,
    });
  }
  return retorno.contato;
}

export async function* iterarContatosTiny(
  filtros: { tipo?: "C" | "F" | "T"; pesquisa?: string } = {},
): AsyncGenerator<{
  pagina: number;
  numeroPaginas: number;
  contatos: TinyContatoResumo[];
  respostaBruta: TinyRetornoPesquisaContatos;
}> {
  let paginaAtual = 1;
  let totalPaginas = 1;

  do {
    const retorno = await listarContatosTiny(paginaAtual, filtros);
    const contatos = (retorno.contatos ?? [])
      .map((c) => c.contato)
      .filter((c): c is TinyContatoResumo => Boolean(c));
    totalPaginas = Number(retorno.numero_paginas ?? 1);

    yield {
      pagina: paginaAtual,
      numeroPaginas: totalPaginas,
      contatos,
      respostaBruta: retorno,
    };

    paginaAtual += 1;
    if (paginaAtual <= totalPaginas) {
      await dormir(env.tiny.delayMs);
    }
  } while (paginaAtual <= totalPaginas);
}

export const ENDPOINTS_TINY = ENDPOINTS;
