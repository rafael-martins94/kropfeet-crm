import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Json } from "../types/database";
import { padraoIlikePostgrest } from "../utils/postgrestFilter";

export type DestinoLink = "brasil" | "europa";
export type SituacaoFiltroLink = "todos" | "ativo" | "expirado" | "desativado";
export type VendaFiltroLink = "todas" | "com" | "sem";

export type VendaDoLink = {
  id: string;
  numero: string | null;
  valor_total: number;
  moeda_venda: string | null;
  status_venda: string;
};

export type LinkPedidoLista = {
  id: string;
  token: string;
  instagram: string;
  nome: string | null;
  destino: DestinoLink;
  moeda: string;
  conta_sumup: string;
  validade_horas: number;
  aberto_em: string | null;
  validade_em: string;
  status: string;
  acessos: number;
  ultimo_acesso_em: string | null;
  vendas_confirmadas: number;
  criado_em: string;
  mensagem_boas_vindas: string | null;
  mensagem_compartilhar: string | null;
  vendas: VendaDoLink[];
};

export type ItemLinkPedido = {
  id: string;
  id_item_estoque: string;
  id_modelo_produto: string;
  preco: number;
  moeda: string;
  preco_original: number | null;
  moeda_original: string | null;
  ordem: number;
  item: {
    id: string;
    sku: string;
    nome_produto: string;
    numeracao_br: number | null;
    numeracao_eu: number | null;
    numeracao_us: string | null;
    preco_venda: number | null;
    moeda_venda: string | null;
    status_item: string;
    local: { nome: string; tipo_regiao: string } | null;
  } | null;
};

export type LinkPedidoDetalhe = LinkPedidoLista & {
  itens: ItemLinkPedido[];
};

type VendaEmbutida = {
  id_venda: string;
  venda: VendaDoLink | VendaDoLink[] | null;
};

const SELECT_LISTA = `
  id, token, instagram, nome, destino, moeda, conta_sumup, validade_horas, aberto_em, validade_em, status,
  acessos, ultimo_acesso_em, vendas_confirmadas, criado_em,
  mensagem_boas_vindas, mensagem_compartilhar,
  vendas:links_pedido_vendas(id_venda, venda:vendas(id, numero, valor_total, moeda_venda, status_venda))
`;

function normalizarVendas(bruto: VendaEmbutida[] | null | undefined): VendaDoLink[] {
  return (bruto ?? []).flatMap((linha) => {
    const venda = Array.isArray(linha.venda) ? linha.venda[0] : linha.venda;
    return venda ? [venda] : [];
  });
}

function normalizarLista(linha: LinkPedidoLista & { vendas: VendaEmbutida[] | null }): LinkPedidoLista {
  return { ...linha, vendas: normalizarVendas(linha.vendas) };
}

export const linksPedidoService = {
  async listar(params: {
    page: number;
    pageSize: number;
    search: string;
    situacao: SituacaoFiltroLink;
    venda: VendaFiltroLink;
  }): Promise<{ data: LinkPedidoLista[]; total: number }> {
    const de = (params.page - 1) * params.pageSize;
    const ate = de + params.pageSize - 1;
    let consulta = supabase
      .from("links_pedido")
      .select(SELECT_LISTA, { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(de, ate);

    const termo = params.search.trim().replace(/^@+/, "");
    if (termo) {
      const padrao = padraoIlikePostgrest(termo);
      consulta = consulta.or(`instagram.ilike.${padrao},nome.ilike.${padrao}`);
    }
    const agora = new Date().toISOString();
    if (params.situacao === "desativado") consulta = consulta.eq("status", "desativado");
    if (params.situacao === "ativo") consulta = consulta.eq("status", "ativo").gt("validade_em", agora);
    if (params.situacao === "expirado") consulta = consulta.eq("status", "ativo").lte("validade_em", agora);
    if (params.venda === "com") consulta = consulta.gt("vendas_confirmadas", 0);
    if (params.venda === "sem") consulta = consulta.eq("vendas_confirmadas", 0);

    const { data, error, count } = await consulta;
    if (error) throw error;
    return {
      data: ((data ?? []) as unknown as Array<LinkPedidoLista & { vendas: VendaEmbutida[] | null }>).map(normalizarLista),
      total: count ?? 0,
    };
  },

  async obter(id: string): Promise<LinkPedidoDetalhe> {
    const { data, error } = await supabase
      .from("links_pedido")
      .select(
        `${SELECT_LISTA}, itens:links_pedido_itens(id, id_item_estoque, id_modelo_produto, preco, moeda, preco_original, moeda_original, ordem, item:itens_estoque(id, sku, nome_produto, numeracao_br, numeracao_eu, numeracao_us, preco_venda, moeda_venda, status_item, local:locais_estoque(nome, tipo_regiao)))`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Link não encontrado.");
    const linha = data as unknown as LinkPedidoDetalhe & { vendas: VendaEmbutida[] | null };
    return { ...normalizarLista(linha), itens: [...(linha.itens ?? [])].sort((a, b) => a.ordem - b.ordem) };
  },

  async criar(input: {
    instagram: string;
    nome: string;
    destino: DestinoLink;
    validadeHoras: 24 | 48 | 72;
    mensagem: string;
    mensagemCompartilhar: string;
    itens: Array<{ id: string; preco: number }>;
  }): Promise<{ id: string; token: string; moeda: string; destino: string }> {
    const { data, error } = await supabase.rpc("link_pedido_criar", {
      p_instagram: input.instagram,
      p_nome: input.nome || null,
      p_destino: input.destino,
      p_validade_horas: input.validadeHoras,
      p_mensagem: input.mensagem || null,
      p_mensagem_compartilhar: input.mensagemCompartilhar || null,
      p_itens: input.itens as unknown as Json,
    });
    if (error) throw error;
    const resultado = data as { id?: string; token?: string; moeda?: string; destino?: string } | null;
    if (!resultado?.id || !resultado.token) throw new Error("O link não foi gerado.");
    return { id: resultado.id, token: resultado.token, moeda: resultado.moeda ?? "", destino: resultado.destino ?? input.destino };
  },

  async desativar(id: string): Promise<void> {
    const { error } = await supabase.rpc("link_pedido_desativar", { p_id: id });
    if (error) throw error;
  },

  async reativar(id: string): Promise<void> {
    const { error } = await supabase.rpc("link_pedido_reativar", { p_id: id });
    if (error) throw error;
  },

  async ultimosPrecos(moeda: string, modelos: string[]): Promise<Record<string, number>> {
    if (modelos.length === 0) return {};
    const { data, error } = await supabase
      .from("historico_preco_destino")
      .select("id_modelo_produto, preco, criado_em")
      .eq("moeda", moeda)
      .in("id_modelo_produto", modelos)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    const mapa: Record<string, number> = {};
    for (const linha of data ?? []) {
      if (mapa[linha.id_modelo_produto] == null) mapa[linha.id_modelo_produto] = Number(linha.preco);
    }
    return mapa;
  },

  async avisosRecentes(): Promise<Array<{ id: string; titulo: string; corpo: string | null; criado_em: string; id_venda: string | null }>> {
    const { data, error } = await supabase
      .from("avisos")
      .select("id, titulo, corpo, criado_em, id_venda")
      .eq("lido", false)
      .order("criado_em", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data ?? [];
  },

  async marcarAvisoLido(id: string): Promise<void> {
    const { error } = await supabase.from("avisos").update({ lido: true }).eq("id", id);
    if (error) throw error;
  },
};

export type ItemPublico = {
  id: string;
  nome: string;
  sku: string;
  numeracao_br: number | null;
  numeracao_eu: number | null;
  numeracao_us: string | null;
  preco: number;
  moeda: string;
  foto: string | null;
  origem: string;
  disponivel: boolean;
  ordem: number;
};

export type LinkPublico = {
  encontrado: boolean;
  situacao?: "ativo" | "expirado" | "desativado";
  destino?: DestinoLink;
  moeda?: string;
  validade_em?: string;
  mensagem?: string | null;
  tratamento?: string;
  itens?: ItemPublico[];
};

export async function abrirLinkPublico(token: string): Promise<LinkPublico> {
  const { data, error } = await supabase.rpc("link_pedido_publico", { p_token: token });
  if (error) throw error;
  return (data ?? { encontrado: false }) as LinkPublico;
}

export type ResultadoCheckoutLink = { id: string; url: string; valor: number; moeda: string };

async function mensagemDaFuncao(erro: unknown): Promise<string | null> {
  if (erro instanceof FunctionsHttpError) {
    const resposta = erro.context as Response;
    const json = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
    if (resposta.status === 404 && !json?.mensagem) return null;
    return json?.mensagem || "Não foi possível iniciar o pagamento.";
  }
  if (erro instanceof FunctionsFetchError || erro instanceof FunctionsRelayError) return null;
  return null;
}

async function chamarProxy(caminho: string, corpo: unknown): Promise<ResultadoCheckoutLink | LinkPublicoStatus> {
  const resposta = await fetch(caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const json = (await resposta.json().catch(() => null)) as (ResultadoCheckoutLink & LinkPublicoStatus & { mensagem?: string }) | null;
  if (!resposta.ok || !json) throw new Error(json?.mensagem || "Não foi possível iniciar o pagamento.");
  if (json.mensagem && !json.id && json.encontrado == null) throw new Error(json.mensagem);
  return json;
}

export async function iniciarPagamentoLink(corpo: Record<string, unknown>): Promise<ResultadoCheckoutLink> {
  const { data, error } = await supabase.functions.invoke("sumup", { body: { acao: "checkout_link", ...corpo } });
  if (!error) {
    const link = data as Partial<ResultadoCheckoutLink> | null;
    if (!link?.id || !link.url) throw new Error("A SumUp não devolveu o pagamento.");
    return { id: link.id, url: link.url, valor: Number(link.valor), moeda: String(link.moeda ?? "") };
  }
  const mensagem = await mensagemDaFuncao(error);
  if (import.meta.env.DEV && (!mensagem || /acesso restrito|não está publicada|não encontrada/i.test(mensagem))) {
    return (await chamarProxy("/api/sumup/checkout-link", corpo)) as ResultadoCheckoutLink;
  }
  if (mensagem) throw new Error(mensagem);
  throw new Error("A função de pagamento ainda não está publicada. O link da SumUp não foi criado.");
}

export type LinkPublicoStatus = {
  encontrado?: boolean;
  situacao?: string;
  id_venda?: string | null;
  confirmacao?: string;
};

export async function consultarPagamentoLink(token: string, idCheckout: string): Promise<LinkPublicoStatus> {
  const corpo = { acao: "consultar_checkout_link", token, id_checkout: idCheckout };
  const { data, error } = await supabase.functions.invoke("sumup", { body: corpo });
  if (!error) return (data ?? { encontrado: false }) as LinkPublicoStatus;
  const mensagem = await mensagemDaFuncao(error);
  if (import.meta.env.DEV && (!mensagem || /acesso restrito|não está publicada|não encontrada/i.test(mensagem))) {
    return (await chamarProxy("/api/sumup/checkout-link/status", { token, id_checkout: idCheckout })) as LinkPublicoStatus;
  }
  if (mensagem) throw new Error(mensagem);
  const { data: local, error: erroLocal } = await supabase.rpc("link_pedido_status_checkout", {
    p_token: token,
    p_id_checkout: idCheckout,
  });
  if (erroLocal) throw erroLocal;
  return (local ?? { encontrado: false }) as LinkPublicoStatus;
}
